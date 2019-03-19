/**
 * 该模块为 render 线程， 负责视图层渲染、
 * 信息更新、用户交互、与主线程通信
 */

const onlineUsers   = require("./ui/onlineUsers");
const htmlModels    = require("./ui/htmlModels");
const sizeFormat    = require("filesize");
const {
  highlightBlock
} = require("highlight.js");
const {
  ipcRenderer,
  remote,
  shell
} = require("electron");

const q  = selector => document.querySelector(selector);
const qa = selector => document.querySelectorAll(selector);

const selfInfoDiv     = q("#self_info");
const selfAvatarImg   = q("#self_info img");
const selfNameDiv     = q("#self_info .name");
const selfIpDiv       = q("#self_info .ip");
const curUserNameDiv  = q("#cur_user_name");
const minimizeBtn     = q("#minimize");
const maximizeBtn     = q("#maximize");
const maximizeBtnI    = q("#maximize i");
const closeBtn        = q("#close");
const userListDiv     = q("#user_list");
const chatWindowSec   = q("#chat_window");
const chatPartSec     = q("#chat_part");
const shareBtn        = q("#share_btn");
const typeInput       = q("#type_input");
const sendBtn         = q("#send_btn");

// 当前对话用户的 id
let curUser = null;

// 主程序窗口
const mainWin = remote.getCurrentWindow();

// 更新 selfInfo
const selfInfo          = remote.getGlobal("selfInfo");
selfAvatarImg.src       = htmlModels.avatarFromId(selfInfo.avatar);
selfNameDiv.textContent = selfInfo.name;
selfIpDiv.textContent   = selfInfo.ip;

ipcRenderer.on("recive-msg", (event, message) => {
  onlineUsers.addMsg(message.uid, "others", "text", message.msg);
  if (message.uid === curUser) {
    reloadChatWindow(message.uid);
  }
  if (!mainWin.isFocused()) {
    createNoti(message.uid);
  }
});

ipcRenderer.on("add-user", (event, user) => {
  onlineUsers.addUser(user);
  addUserToList(user);
});

ipcRenderer.on("del-user", (event, uid) => {
  if (curUser === uid) {
    // 当前用户已下线
    typeInput.disabled = true;
    typeInput.placeholder = "当前用户已下线";
  }
  onlineUsers.delUser(uid);
  delUserFromList(uid);
});

// 聊天窗口滚动到底部
function toBottom() {
  chatWindowSec.scrollTop = chatWindowSec.scrollHeight + 100;
}

// 系统消息通知
function createNoti(uid) {
  const avatar = onlineUsers.getInfo(uid, "avatar");
  const noti = new Notification("新消息", {
    body: `from: ${onlineUsers.getInfo(uid, "name")}`,
    icon: htmlModels.avatarFromId(avatar)
  });
  noti.onclick = () => {
    noti.close();
    mainWin.show();
    mainWin.focus();
    selectUser(uid);
  };
}

// 通用文件事件处理函数
function fileDataEventHandler(event, info) {
  const data = {
    fileName: info.fileName,
    status: "noti"
  };
  if (info.type === "file") {
    data.size = info.size;
  }
  onlineUsers.addMsg(info.uid, "others", info.type, data);
  if (curUser === info.uid) {
    reloadChatWindow(info.uid);
  }
  if (!mainWin.isFocused()) {
    createNoti(info.uid);
  }
}

// 图片事件
ipcRenderer.on("image", fileDataEventHandler);

// 文件事件
ipcRenderer.on("file", fileDataEventHandler);

/**
 * 通用接收文件函数
 * @param {string} type 
 * @param {Node} msgBoxDiv 
 * @param {Object} info 
 * @param {string} info.uid
 * @param {string} info.fileName
 */
function fAccept(type, infoStr) {
  const info        = JSON.parse(infoStr);
  const fileEvt     = `${info.uid}-${type}-${info.fileName}`;
  const progressEvt = `progress-recive-${info.uid}-${info.fileName}`;
  const finishEvt   = fileEvt + "-finish";

  // 更改消息状态
  onlineUsers.setChatRecordData(info.uid, info.position, "status", "processing");
  // 更新视图
  reloadChatWindow(info.uid);

  if (info.type === "file") {
    // 注册接收中监视器信息事件
    ipcRenderer.on(progressEvt, (event, progress) => {
      const progressNode = q(`#progress-recive-${info.uid}-${htmlModels.formatFileName(info.fileName)}`);
      const speedNode    = q(`#progress-recive-speed-${info.uid}-${htmlModels.formatFileName(info.fileName)}`);
      if (progressNode) {
        progressNode.textContent = Math.trunc(progress.percentage) + "%";
      }
      if (speedNode) {
        speedNode.textContent = sizeFormat(progress.speed) + "/s";
      }
    });
  }

  // 注册接收完成事件
  ipcRenderer.once(finishEvt, (event, path) => {
    // 清除 progressEvt
    ipcRenderer.removeAllListeners([progressEvt]);

    onlineUsers.setChatRecordData(info.uid, info.position, "status", "done");
    onlineUsers.setChatRecordData(info.uid, info.position, "path", path);
    // 更新视图
    if (info.uid === curUser) {
      reloadChatWindow(info.uid);
    }
  });

  ipcRenderer.send(fileEvt, "accept");
}

/**
 * 通用拒绝文件函数
 * @param {string} type 
 * @param {Node} msgBoxDiv 
 * @param {Object} info 
 * @param {string} info.uid
 * @param {string} info.fileName
 */
function fReject(type, infoStr) {
  const info = JSON.parse(infoStr);
  const fileEvt = `${info.uid}-${type}-${info.fileName}`;
  const content =
    type === "image" ? "图片已拒收" :
    type === "file" ? "文件已拒收" : null;
  msgBoxDiv.textContent = content;
  ipcRenderer.send(fileEvt, "reject");
}

function addUserToList(user) {
  const defaultList = q(".default_list");
  defaultList && defaultList.remove();
  // 如果用户已存在，删除并添加新的
  const exists = q(`#user_list div[data-uid="${user.uid}"]`);
  exists && exists.remove();
  const other = htmlModels.createOthers(user);
  userListDiv.insertAdjacentHTML("beforeend", other);
}

function delUserFromList(uid) {
  const user = q(`#user_list div[data-uid="${uid}"]`);
  user && user.remove();
  if (!userListDiv.childElementCount) {
    const defaultList = htmlModels.createDefaultList();
    userListDiv.insertAdjacentHTML("beforeend", defaultList);
    typeInput.disabled = true;
  }
}

function selectUser(uid) {
  if (uid === curUser) {
    return;
  }

  typeInput.disabled = false;
  typeInput.placeholder = "输入消息...";
  const board = q(".board");
  board && board.remove();

  curUser = uid;
  curUserNameDiv.textContent = onlineUsers.getInfo(uid, "name");
  reloadChatWindow(uid);
}

function addElemToChatWin(msgHTML) {
  chatWindowSec.insertAdjacentHTML("beforeend", msgHTML);
}

function reloadChatWindow(uid) {
  if (curUser !== uid) {
    return;
  }
  chatWindowSec.innerHTML = "";
  onlineUsers.getChatRecords(uid).forEach(chatRecord => {
    const avatar =
      chatRecord.side === "self" ?
        selfInfo.avatar : onlineUsers.getInfo(uid, "avatar");
    const info = {
      uid, avatar,
      side:     chatRecord.side,
      path:     chatRecord.data.path,
      msg:      chatRecord.data,
      fileName: chatRecord.data.fileName,
      size:     chatRecord.data.size,
      position: chatRecord.position,
      type:     chatRecord.type
    };
    const createFunc = htmlModels.funcSelector(
      chatRecord.type,
      chatRecord.data.status
    );
    const msgHTML = createFunc(info);
    
    addElemToChatWin(msgHTML);
  });
  toBottom();
  for (const code of qa("pre")) {
    highlightBlock(code);
  }
}

function minimize() {
  mainWin.minimize();
}

function toggleMaximize() {
  mainWin.isMaximized() ?
    mainWin.unmaximize() :
    mainWin.maximize();
}

mainWin.on("maximize", () => {
  maximizeBtnI.className = "icon-unmaximize";
});

mainWin.on("unmaximize", () => {
  maximizeBtnI.className = "icon-maximize";
});

function hideMainWin() {
  mainWin.hide();
}

function sendMsg() {
  const msg = typeInput.value;
  typeInput.value = "";
  if (!curUser || msg.trim() === "") {
    return;
  }
  onlineUsers.addMsg(curUser, "self", "text", msg);
  reloadChatWindow(curUser);
  ipcRenderer.send("send-msg", {
    msg,
    target: onlineUsers.getInfo(curUser, "ip")
  });
}

function broadcast() {
  ipcRenderer.send("broadcast");
}

function showLargeImg(path) {
  // const imageWin = new remote.BrowserWindow({

  // });
}

// 通用发送文件事件接口
function sendFileData(info) {
  const sendEvt       = `${info.uid}-${info.type}-${info.fileName}-send`;
  const progressEvt   = `progress-send-${info.uid}-${info.fileName}`;
  const sendStartEvt  = sendEvt + "-processing";
  const rejectedEvt   = sendEvt + "-rejected";
  const finishEvt     = sendEvt + "-finish";

  // 更新消息
  const data = {
    fileName: info.fileName,
    status: "noti",
    path: info.path
  };
  if (info.type === "file") {
    data.size = info.size;
    // 注册发送中监视器信息事件
    ipcRenderer.on(progressEvt, (event, progress) => {
      const progressNode = q(`#progress-send-${info.uid}-${htmlModels.formatFileName(info.fileName)}`);
      const speedNode    = q(`#progress-send-speed-${info.uid}-${htmlModels.formatFileName(info.fileName)}`);
      if (progressNode) {
        progressNode.textContent = Math.trunc(progress.percentage) + "%";
      }
      if (speedNode) {
        speedNode.textContent = sizeFormat(progress.speed) + "/s";
      }
    });
  }
  // 添加消息
  const position = onlineUsers.addMsg(info.uid, info.side, info.type, data);
  // 更新视图
  reloadChatWindow(info.uid);
  // 注册文件开始发送的事件
  ipcRenderer.once(sendStartEvt, () => {
    onlineUsers.setChatRecordData(info.uid, position, "status", "processing");
    reloadChatWindow(info.uid);
  });
  // 注册文件被拒绝事件
  ipcRenderer.once(rejectedEvt, () => {
    ipcRenderer.removeAllListeners([
      progressEvt, finishEvt, sendStartEvt
    ]);
    onlineUsers.setChatRecordData(info.uid, position, "status", "rejected");
    reloadChatWindow(info.uid);
  });
  // 注册文件发送完成事件
  ipcRenderer.once(finishEvt, (event, err) => {
    ipcRenderer.removeAllListeners([
      progressEvt, rejectedEvt
    ]);
    if (err) {
      return;
    }
    onlineUsers.setChatRecordData(info.uid, position, "status", "done");
    reloadChatWindow(info.uid);
  });

  // 发送事件
  sendFileIpc(info);
}

function sendFileIpc(info) {
  info.target = onlineUsers.getInfo(info.uid, "ip");
  ipcRenderer.send(`send-${info.type}`, info);
}

// 回车发送消息
typeInput.onkeypress = event => {
  if (event.keyCode == 13) {
      event.preventDefault();
      sendMsg();
  }
}

// 选择文件并发送
function selectFile() {
  if (!curUser) {
    return;
  }
  ipcRenderer.send("select-file", {
    target: onlineUsers.getInfo(curUser, "ip"),
    uid: curUser
  });
}
ipcRenderer.on("send-file-chose", (event, info) => sendFileData(info));

// 在文件夹中打开文件
function openPath(path) {
  shell.showItemInFolder(path);
}

// 以默认方式打开文件
function openFile(path) {
  shell.openItem(path);
}

// 向聊天窗口拖放文件事件
chatPartSec.addEventListener("drop", e => {
  e.preventDefault();
  e.stopPropagation();

  if (!curUser) {
    return;
  }

  for (f of e.dataTransfer.files) {
    const info = {
      uid: curUser,
      path: f.path,
      side: "self",
      avatar: selfInfo.avatar,
      fileName: f.name.replace(/\s+/g, "")
    };
    if (f.type.includes("image")) {
      // 图片传输
      info.type = "image";
      sendFileData(info);
    } else {
      // 普通文件传输
      info.size = f.size;
      info.type = "file";
      sendFileData(info);
    }
  }
});

chatPartSec.addEventListener("dragover", e => {
  e.preventDefault();
  e.stopPropagation();
});

// 阻止拖放的默认行为
function preventDefault(e) {
  e.preventDefault();
}
window.ondragenter = preventDefault;
window.ondragover  = preventDefault;
window.ondrop      = preventDefault;