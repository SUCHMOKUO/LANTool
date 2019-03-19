/**
 * 该模块为 APP 主线程，负责控制应用生命周期、
 * 处理和调度消息的发送与接收
 */

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  dialog
} = require("electron");

// 进程实例数量检测（仅允许一个 app 实例运行）
// const isSecondInstance = app.makeSingleInstance(() => {
//   function showWin(winName) {
//     if (!global[winName].isVisible()) {
//       global[winName].show();
//     }
//     global[winName].focus();
//   }

//   // 当第二个进程实例开启时显示并聚焦第一个实例主窗口
//   global.mainWin && showWin("mainWin");
//   global.userInitWin && showWin("userInitWin");
// });

// 杀死第二个进程实例
// if (isSecondInstance) {
//   app.exit();
// }

const { spawn }    = require("child_process");
const myIp         = require("internal-ip").v4.sync();
const randomID     = require("crypto-random-string");
const progress     = require("progress-stream");
const fs           = require("fs");
const comm         = require("./communication");    // 通信模块
const {
  basename,
  extname
} = require("path");

const downloadsFolder = app.getPath("downloads");
const lanToolFolder   = `${downloadsFolder}/LANTool`;
const imageFolder     = lanToolFolder + "/images";  // 图片文件夹
const fileFolder      = lanToolFolder + "/files";   // 默认文件下载文件夹

try {
  fs.mkdirSync(lanToolFolder);
  fs.mkdirSync(imageFolder);
  fs.mkdirSync(fileFolder);
} catch (e) {}

// 创建新用户
function createNewUser() {
  global.userInitWin = new BrowserWindow({
    width: 780,
    height: 500,
    minWidth: 780,
    minHeight: 500,
    frame: false,
    show: false
  });
  global.userInitWin.loadURL(`file://${__dirname}/createNewUser.html`);
  global.userInitWin.once("ready-to-show", () => global.userInitWin.show());

  return new Promise((resolve, reject) => {
    ipcMain.once("new-user-creation-done", (event, selfInfo) => {
      resolve(selfInfo);
    })
  });
}

// 向主窗口 render 线程发送消息
function sendToMainWin(...args) {
  global.mainWin && global.mainWin.webContents.send(...args);
}

// Python 子进程.
const pyChild = spawn("python3", [`${__dirname}/python/message.py`, myIp]);

pyChild.stderr.on("data", err => {
  console.log(err.toString());
});

// 文本消息事件
comm.on("message", message => {
  sendToMainWin("recive-msg", message);
});

// 发送文本信息的请求事件
ipcMain.on("send-msg", (event, message) => {
  comm.sendTextMsg(message.target, message.msg);
});

// 握手消息事件
comm.on("handshake", user => {
  sendToMainWin("add-user", user);
  comm.handshakeACK(user.ip);
});

// 广播上线握手消息的请求事件
ipcMain.on("broadcast", comm.broadcast);

// 握手确认消息事件
comm.on("handshakeACK", user => {
  sendToMainWin("add-user", user);
});

// 其他客户端的下线广播消息事件
comm.on("offline", ({ uid }) => {
  sendToMainWin("del-user", uid);
});

// 通用文件消息事件处理函数
function fileDataHandler(socket, info) {
  const fileEvt     = `${info.uid}-${info.type}-${info.fileName}`;
  const progressEvt = `progress-recive-${info.uid}-${info.fileName}`;
  const finishEvt   = fileEvt + "-finish";

  // 注册文件是否接收的事件
  ipcMain.once(fileEvt, (event, status) => {
    if (status === "accept") {
      let path, monitor;
      if (info.type === "image") {
        path = imageFolder + "/" + info.fileName;
      } else {
        path = fileFolder + "/" + info.fileName;
        // 速度、接收量监视器
        monitor = progress({
          length: info.size,
          time: 200
        });
        // 接收时实时监视事件
        monitor.on("progress", progress => {
          sendToMainWin(progressEvt, progress);
        });
      }
      const ws = fs.createWriteStream(path);
      // 文件写入本地完成事件
      ws.once("finish", () => {
        sendToMainWin(finishEvt, path);
      });
      socket.fAccept(ws, monitor);
    } else if(status === "reject") {
      socket.fReject();
    }
  });
  // 发送接收文件事件到 render 线程
  sendToMainWin(info.type, info);
}

// 通用发送文件事件处理函数
function sendFileDataHandler(event, info) {
  const sendEvt     = `${info.uid}-${info.type}-${info.fileName}-send`;
  const progressEvt = `progress-send-${info.uid}-${info.fileName}`;
  const sendStartEvt  = sendEvt + "-processing";
  const finishEvt   = sendEvt + "-finish";

  let rs, sendFunc;
  if (info.type === "image") {
    rs = fs.createReadStream(info.path);
    sendFunc = comm.sendImage;
  } else {
    // 速度、接收量监视器
    const monitor = progress({
      length: info.size,
      time: 200
    });
    // 传输时实时监视事件
    monitor.on("progress", progress => {
      sendToMainWin(progressEvt, progress);
    });
    rs = fs.createReadStream(info.path).pipe(monitor);
    sendFunc = comm.sendFile;
  }
  info.rs = rs;
  // 向 render 线程发送开始发送文件的事件
  sendFunc(info, () => {
    sendToMainWin(sendStartEvt);
  }, err => {
    // 发送完成，向 render 线程发送消息
    sendToMainWin(finishEvt, err);
  });
}

// 文件类型判断
function fileType(extname) {
  return extname === ".jpg" ? "image" :
    extname === ".jpeg" ? "image" :
    extname === ".png" ? "image" :
    extname === ".gif" ? "image" :
    extname === ".bmp" ? "image" :
    extname === ".ico" ? "image" : "file";
}

// 图片消息事件
comm.on("image", fileDataHandler);

// 发送图片消息的请求事件
ipcMain.on("send-image", sendFileDataHandler);

// 文件消息事件
comm.on("file", fileDataHandler);

// 发送文件消息的请求事件
ipcMain.on("send-file", sendFileDataHandler);

// 选择文件发送事件
ipcMain.on("select-file", (event, { target, uid }) => {
  dialog.showOpenDialog({
    buttonLabel: "发送",
    properties: ["openFile", "multiSelections"]
  }, paths => {
    paths && paths.forEach(path => {
      const info = {
        uid,
        path,
        target,
        side: "self",
        avatar: global.selfInfo.avatar,
        type: fileType(extname(path)),
        fileName: basename(path).replace(/\s+/g, "")
      };
      if (info.type === "file") {
        info.size = fs.statSync(path).size;
      }
      sendToMainWin("send-file-chose", info);
    });
  });
});

// 来自 render 线程的 app 退出请求事件
ipcMain.once("app-quit", app.quit);

app.once("before-quit", () => {
  comm.offline();   // 退出前发送下线广播
});

app.on("ready", async () => {
  // 从配置文件获取用户信息
  try {
    global.selfInfo = require("./selfInfo.json");
  } catch(e) {
    // 用户为新用户，新建配置文件
    global.selfInfo = await createNewUser();
    global.selfInfo.uid = randomID(8);
    fs.writeFileSync(`${__dirname}/selfInfo.json`, JSON.stringify(selfInfo));
  }
  global.selfInfo.ip = myIp;

  // 创建主窗口
  global.mainWin = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 900,
    minHeight: 640,
    frame: false,
    show: false
  });
  global.mainWin.loadURL(`file://${__dirname}/main.html`);
  global.mainWin.once("ready-to-show", () => {
    if (global.userInitWin) {
      global.userInitWin.close();
      global.userInitWin = null;
    }
    global.mainWin.show();
    comm.broadcast();
  });

  //global.mainWin.webContents.openDevTools();

  // 系统托盘
  global.tray = new Tray(`${__dirname}/img/owl.png`);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主界面',
      click() {
        global.mainWin.show();
        global.mainWin.focus();
      }
    }, {
      label: '退出',
      click: app.quit
    }
  ]);
  global.tray.setToolTip('LAN-Tool');
  global.tray.setContextMenu(contextMenu);
});