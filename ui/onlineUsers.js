/**
 * 该模块为在线用户数据管理模块，包含一个 onlineUsers 对象
 * 并向外暴露相关数据操作函数
 */

const onlineUsers = {};

// 添加用户
onlineUsers.addUser = function(user) {
  // 如果已存在，更改 userInfo，保留 chatRecord
  if (this.hasOwnProperty(user.uid)) {
    this[user.uid].userInfo = user;
    return;
  }
  // 如果为新上线用户
  this[user.uid] = {
    chatRecords: [],
    userInfo: user
  };
}

// 删除用户
onlineUsers.delUser = function(uid) {
  delete this[uid];
}

// 添加消息记录
onlineUsers.addMsg = function(uid, side, type, data) {
  const position = this[uid].chatRecords.length;
  this[uid].chatRecords.push({
    side, type, data, position
  });
  return position;
}

// 获取用户信息
onlineUsers.getInfo = function(uid, info) {
  return this[uid].userInfo[info];
}

// 更改消息记录数据
onlineUsers.setChatRecordData = function(uid, position, field, value) {
  this[uid].chatRecords[position].data[field] = value;
}

// 获取消息记录
onlineUsers.getChatRecords = function(uid) {
  return this[uid].chatRecords;
}

module.exports = onlineUsers;