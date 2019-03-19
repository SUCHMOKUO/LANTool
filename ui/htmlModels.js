/**
 * 该模块为 HTML 模板， 提供动态生成
 * HTML 字符串的函数以及其他相关函数
 */

const { basename } = require("path");
const sizeFormat   = require("filesize");

function _completeTime(time) {
  time = String(time);
  return time.length === 1 ? "0" + time : time;
}

function _getTime() {
  const date = new Date();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${_completeTime(hours)}:${_completeTime(minutes)}`;
}

/**
 * @param {Object} user 
 */
function createOthers(user) {
  return `
    <div class="others" data-uid="${user.uid}" onclick="selectUser(this.dataset.uid)">
      <div class="avatar">
        <img src="${avatarFromId(user.avatar)}">
      </div>
      <div class="info">
        <div>
          <div class="name">${user.name}</div>
          <span class="time">${_getTime()}</span>
        </div>
        <div class="ip">${user.ip}</div>
      </div>
    </div>
  `;
}

function createDefaultList() {
  return `
    <div class="default_list">
      <span>局域网内无其他用户</span>
      <button onclick="broadcast()">刷新</button>
    </div>`;
}

function createBoard() {
  return `
    <div class="board">
      <div class="half-trans-bg">
        <h1>LAN-Tool</h1>
        <h2>即时·高效</h2>
        <h3>现在开始!</h3>
      </div>
    </div>`;
}

function createChatBox(info, inBoxHTML) {
  return info.side === "others" ? `
    <div class="others_msg">
      <div class="avatar">
        <img src="${avatarFromId(info.avatar)}">
      </div>
      <div class="${info.side}_msg_box">${inBoxHTML}</div>
    </div>` : `
    <div class="self_msg">
      <div class="${info.side}_msg_box">${inBoxHTML}</div>
      <div class="avatar">
        <img src="${avatarFromId(info.avatar)}">
      </div>
    </div>`;
}

const _acceptEvt = info =>
  "onclick=fAccept('" + info.type + "','" + JSON.stringify(info) + "')";

const _rejectEvt = info =>
  "onclick=fReject('" + info.type + "','" + JSON.stringify(info) + "')";

function createMsg(info) {
  return createChatBox(info, `
    <pre><code>${info.msg}</code></pre>`);
}

function createImageMsg(info) {
  return createChatBox(info, _createImageInBox(info.path));
}

function _createImageInBox(path) {
  return `<img src="file://${path}" class="msg_img" onclick="showLargeImg('${path}')">`;
}

function createImageNoti(info) {
  return info.side === "self" ?
    createImageMsg(info) :
    createChatBox(info, `图片消息：<button ${_acceptEvt(info)}>显示</button>`);
}

function createFileMsg(info) {
  return createChatBox(info, `
    <div class="file">
      <div class="left">
        <button class="roundBtn" onclick="openFile('${info.path}')">
          <i class="icon-ok"></i>
        </button>
      </div>
      <div class="right">
        <span class="file_name">${info.fileName}</span>
        <div>
          <span class="content">${sizeFormat(info.size)}</span>
          <button onclick="openPath('${info.path}')">打开所在文件夹</button>
        </div>
      </div>
    </div>`
  );
}

function createFileNoti(info) {
  return info.side === "self" ? createChatBox(info, `
    <div class="file">
      <div class="left">
        <button class="roundBtn">
          <i class="icon-loader roll"></i>
        </button>
      </div>
      <div class="right">
        <span class="file_name">${info.fileName}</span>
        <span class="content">正在等待接收</span>
      </div>
    </div>
  `) : createChatBox(info, `
    <div class="file">
      <div class="left">
          <button class="roundBtn" ${_acceptEvt(info)}>
            <i class="icon-download"></i>
          </button>
      </div>
      <div class="right">
        <span class="file_name">${info.fileName}</span>
        <div>
          <span class="content">${sizeFormat(info.size)}</span>
          <button ${_rejectEvt(info)}>暂不接收</button>
        </div>
      </div>
    </div>`
  );
}

function createFileProcessing(info) {
  return createChatBox(info, `
    <div class="file">
      <div class="left">
        <button class="roundBtn" id="${_getProgressId(info)}">0%</button>
      </div>
      <div class="right">
        <span class="file_name">${info.fileName}</span>
        <div>
          <span class="content" id="${_getProgressSpeedId(info)}">0B/s</span>
          <button ${_rejectEvt(info)}>取消</button>
        </div>
      </div>
    </div>`
  );
}

// 传输进度 id
function _getProgressId(info) {
  return info.side === "self" ? `progress-send-${info.uid}-${formatFileName(info.fileName)}` :
    info.side === "others" ? `progress-recive-${info.uid}-${formatFileName(info.fileName)}` : null;
}

// 已接收或已发送的量的 id
function _getProgressSpeedId(info) {
  return info.side === "self" ? `progress-send-speed-${info.uid}-${formatFileName(info.fileName)}` :
    info.side === "others" ? `progress-recive-speed-${info.uid}-${formatFileName(info.fileName)}` : null;
}

function createFileRejected(info) {
  return createChatBox(info, `
    <div class="file">
      <div class="left">
        <button class="roundBtn">
          <i class="icon-close"></i>
        </button>
      </div>
      <div class="right">
        <span class="file_name">${info.fileName}</span>
        <span class="content">拒绝接收</span>
      </div>
    </div>`
  );
}

function createImageProcessing(info) {
  return info.side === "self" ?
    createImageMsg(info) :
    createChatBox(info, `<i class="icon-loader roll"></i>`);
}

function createImageRejected() {
  return createChatBox(info, ``)
}

function formatFileName(fileName) {
  return fileName.replace(/[`~!@#$%^&*()+=.,;:'"<>?/（）\[\]\s，。；{}·「、×……￥！～\\]+/g, "");
}

function avatarFromId(id) {
  return avatarFromId.avatars[+id];
}

avatarFromId.avatars = {
  0: "./img/bird.png",
  1: "./img/cat.png",
  2: "./img/chick.png",
  3: "./img/godzilla.png",
  4: "./img/kitty.png",
  5: "./img/owl.png",
  6: "./img/snails.png",
  7: "./img/sun.png"
}

function funcSelector(type, status) {
  console.log(type, status);
  if (status) {
    return funcSelector.funcs[`${type}-${status}`];
  } else {
    return funcSelector.funcs[type];
  }
}

funcSelector.funcs = {
  "text":             createMsg,
  "image-noti":       createImageNoti,
  "image-processing": createImageMsg,
  "image-done":       createImageMsg,
  "image-rejected":   createImageRejected,
  "file-noti":        createFileNoti,
  "file-processing":  createFileProcessing,
  "file-done":        createFileMsg,
  "file-rejected":    createFileRejected,
}

module.exports = {
  createOthers,
  createDefaultList,
  createBoard,
  createMsg,
  createFileMsg,
  createFileProcessing,
  createFileRejected,
  createFileNoti,
  createImageMsg,
  createImageNoti,
  createImageProcessing,
  createImageRejected,
  avatarFromId,
  formatFileName,
  funcSelector
}