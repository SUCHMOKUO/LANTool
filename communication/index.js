/**
 * 该模块为通信模块，包含一个继承于 Node EventEmitter
 * 的 Communcation 的实例 comm
 * 
 * 提供与 Python 子进程通信、
 * 与其他客户端通信的方法
 */

const dgram        = require("dgram");
const net          = require("net");
const EventEmitter = require("events");
const {
  createGzip,
  createGunzip
} = require("zlib");
const {
  cmd,
  cmdToName,
  createRequest,
  createReply,
  parseRequest,
  parseReply,
  status
} = require("./protocol");

const nodePort   = 36256;
const pyPort     = 36257;
const appPort    = 36258;

class Communication extends EventEmitter {
  // 发送文本信息
  sendTextMsg(target, msg) {
    sendToPy(JSON.stringify({
      cmd: cmd.message,
      uid: global.selfInfo.uid,
      msg,
      target
    }));
  }

  // 广播上线消息
  broadcast() {
    sendToPy(JSON.stringify({
      cmd:    cmd.handshake,
      name:   global.selfInfo.name,
      avatar: global.selfInfo.avatar,
      uid:    global.selfInfo.uid
    }));
  }

  // 发送握手确认包
  handshakeACK(target) {
    sendToPy(JSON.stringify({
      cmd:    cmd.handshakeACK,
      name:   global.selfInfo.name,
      avatar: global.selfInfo.avatar,
      uid:    global.selfInfo.uid,
      target
    }));
  }

  // 广播下线消息
  offline() {
    sendToPy(JSON.stringify({
      cmd: cmd.offline,
      uid: global.selfInfo.uid
    }));
  }

  // 发送图片
  sendImage({ target, rs, fileName }, startSendEvt, callback) {
    sendFileData(target, rs, {
      cmd: cmd.image,
      uid: global.selfInfo.uid,
      fileName
    }, startSendEvt, callback);
  }

  // 发送文件
  sendFile({ target, rs, size, fileName }, startSendEvt, callback) {
    sendFileData(target, rs, {
      cmd: cmd.file,
      uid: global.selfInfo.uid,
      fileName,
      size
    }, startSendEvt, callback);
  }
}

const ipcSocket  = dgram.createSocket("udp4");  // 与 Python 子进程通信的 udp Socket
const appServer  = new net.Server();            // 应用的文件类消息处理服务
const comm       = new Communication();         // Communication 的实例

appServer
  .on("connection", requestHandler)
  .listen({
    port: appPort,
    host: "0.0.0.0"
  });

// 文件服务的连接处理函数
function requestHandler(socket) {
  socket.once("data", req => {
    req = parseRequest(req);

    if (req.cmd === cmd.file) {
      // 注册同意接收函数
      socket.fAccept = _accept(cmd.file, socket);
      // 注册拒绝接收函数
      socket.fReject = _reject(cmd.file, socket);
      // 触发文件事件
      comm.emit("file", socket, {
        uid: req.uid,
        fileName: req.fileName,
        size: req.size,
        type: "file"
      });

    } else if (req.cmd === cmd.image) {
      // 注册同意接收函数
      socket.fAccept = _accept(cmd.image, socket);
      // 注册拒绝接收函数
      socket.fReject = _reject(cmd.image, socket);
      // 触发图片事件
      comm.emit("image", socket, {
        uid: req.uid,
        fileName: req.fileName,
        type: "image"
      });
    }
  });
}

function _accept(cmd, socket) {
  return (fileWriteStream, monitor) => {
    socket.write(createReply(cmd, status.accept));
    if (monitor) {
      socket
      .pipe(monitor)
      .pipe(createGunzip())
      .pipe(fileWriteStream);
    } else {
      socket
      .pipe(createGunzip())
      .pipe(fileWriteStream);
    }
  }
}

function _reject(cmd, socket) {
  return () => {
    socket.end(createReply(cmd, status.reject));
  }
}

/**
 * 通用文件传输接口
 * @param {string} target 目的地 ip 地址
 * @param {stream} rstream 可读流
 * @param {object} reqObj
 * @param {number} reqObj.cmd
 * @param {string} reqObj.uid
 * @param {string} reqObj.fileName
 * @param {number} reqObj.size 当 cmd 为图片时可省略
 * @callback startSendEvt
 * @callback finishEvt
 */
async function sendFileData(target, rstream, reqObj, startSendEvt, doneEvt) {
  try {
    const socket = await sendFileDataHandShake(target, createRequest(reqObj));
    // 文件传输开始
    startSendEvt();
    rstream
      .pipe(createGzip())
      .pipe(socket);
    // 文件传输完毕，执行回调函数
    socket.once("finish", doneEvt);
  } catch (e) {
    doneEvt(e);
  }
}

// 通用文件传输部分握手
function sendFileDataHandShake(target, reqBuf) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket
      .once("connect", () => socket.write(reqBuf))
      .once("data", repBuf => {
        const rep = parseReply(repBuf);
        if (rep.status === status.accept) {
          resolve(socket);
        } else {
          reject(1);
        }
      })
      .connect({
        port: appPort,
        host: target
      });
  });
}

/**
 * 与 python 的 ipc 通信 socket
 */
ipcSocket
  .on("message", msgHandler)
  .bind({
    port: nodePort,
    exclusive: true,
    address: "127.0.0.1"
  });

/**
 * @param {String} data 
 */
function sendToPy(data) {
  ipcSocket.send(data, pyPort, "127.0.0.1");
}

/**
 * @param {Buffer} msg 
 */
function msgHandler(msg) {
  const dataObj = JSON.parse(msg);
  const cmd = dataObj.cmd;
  delete dataObj.cmd;
  // 如果是自己的广播包则中断函数
  if (dataObj.uid === global.selfInfo.uid) {
    return;
  }
  comm.emit(cmdToName[+cmd], dataObj);
}

module.exports = comm;