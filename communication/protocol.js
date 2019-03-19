/**
 * 该模块为本应用的协议部分
 * 提供字节流数据解析、字节流数据生成函数
 * 以及协议定义的参数索引
 */

const hexarr = require("hex-array");

// 协议识别码
const mark = 0xE9;

// 命令码
const cmd = {
  handshake:    0x00,
  message:      0x01,
  handshakeACK: 0x02,
  offline:      0x03,
  image:        0x04,
  file:         0x05,
  folder:       0x06
};

// 命令码翻译
const cmdToName = {
  0x00: "handshake",
  0x01: "message",
  0x02: "handshakeACK",
  0x03: "offline",
  0x04: "image",
  0x05: "file",
  0x06: "folder"
};

// 状态码
const status = {
  accept: 0x00,
  reject: 0x01
};

/**
 * 由参数生成 Reply 字节流
 * @param {Number} cmd 
 * @param {Number} status
 * @returns {Buffer} 
 */
function createReply(cmd, status) {
  return Buffer.from([mark, cmd, status]);
}

/**
 * 从字节流解析出 Reply 对象
 * @param {Buffer} buf
 * @returns {Object}
 */
function parseReply(buf) {
  if (buf[0] !== mark) {
    return null;
  }
  return {
    cmd:    buf[1],
    status: buf[2]
  };
}

/**
 * 由参数对象生成 Request 字节流
 * @param {Number} cmd 
 * @param {Object} reqObj 
 * @returns {Buffer}
 */
function createRequest(reqObj) {
  const bufArr = [mark, reqObj.cmd, ...Buffer.from(global.selfInfo.uid)];
  if (reqObj.cmd === cmd.file) {
    const fileNameBuf = Buffer.from(reqObj.fileName);
    const hexSizeStr = reqObj.size.toString(16);
    const sizeBuf = Buffer.from(hexarr.fromString(hexSizeStr));
    bufArr.push(
      fileNameBuf.length,
      ...fileNameBuf,
      ...sizeBuf
    );
  } else if (reqObj.cmd === cmd.image) {
    bufArr.push(...Buffer.from(reqObj.fileName));
  }
  return Buffer.from(bufArr);
}

/**
 * 从字节流解析出 Request 对象
 * @param {Buffer} buf
 * @returns {Object} 
 */
function parseRequest(buf) {
  const reqObj = {
    cmd: buf[1],
    uid: buf.slice(2, 10).toString()
  };
  if (reqObj.cmd === cmd.file) {
    const fileNameLen = buf[10];
    reqObj.fileName = buf.slice(11, 11 + fileNameLen).toString();
    const sizeBuf = buf.slice(11 + fileNameLen);
    reqObj.size = parseInt(hexarr.toString(sizeBuf), 16);
  }
  if (reqObj.cmd === cmd.image) {
    reqObj.fileName = buf.slice(10).toString();
  }
  console.log("parse:", reqObj);
  return reqObj;
}

module.exports = {
  parseReply,
  parseRequest,
  createReply,
  createRequest,
  cmd,
  cmdToName,
  status
};