#!usr/bin/env python
#-*-coding:utf-8-*-
#author:lim time:2018/4/30

from packet import *
import socket
from threading import Thread
import sys

'''
程序的底层消息发送采用Python 然后将接受到的消息发送给上层的UI
本程序主要分成两个部分，responseMsg负责监听底层的消息 然后转发给UI
ipcSend则负责监听UI的消息，然后发送给Python底层进行通信
'''

#上线和下线广播地址和端口
broadcastAddr = ("<broadcast>", 36258)
#通信的本机IP和Port
localAddr = ("", 36258)
#创建通信的套接字
udpSocket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
#将本机的IP和Port与套接字绑定
udpSocket.bind(localAddr)
udpSocket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

#创建与上层Node通信套接字

ipcAddr = ("127.0.0.1",36257)
nodeAddr = ("127.0.0.1",36256)
#创建与UI通信的套接字
ipcSocket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
ipcSocket.bind(ipcAddr)

#底层resPonseMsg退出的标志
singal = True

def getHostIp():
    #获取当前主机IP
    hostIp = sys.argv[1]
    return hostIp

def broadcast(cmd,data,udpSocket):
    #上线下线广播
    packet = packData(cmd, data)
    udpSocket.sendto(packet,broadcastAddr)


def sendTo(cmd,ip,data,udpSocket):
    #Python底层发送数据包
    sendAddr = (ip,36258)
    #调用packet.py 的packData函数 封装数据包
    sendData = packData(cmd,data)
    udpSocket.sendto(sendData,sendAddr)

def ipcSend(dataDict):
    #发送给UI的数据包
    #调用packet.py 的 packIpc 封装数据包 将数据打包成json格式
    data = packIpc(dataDict)
    byteData = bytes(data,encoding="utf-8")
    ipcSocket.sendto(byteData,nodeAddr)

HostIp = getHostIp()


#阅读此段代码前，请先阅我们消息发送部分的协议
def responseMsg():
    #守护线程 监听底层数据包
    
    while singal:
        #若UI退出 singal为False 则退出该线程 整个程序的进程结束
        recData, recAddr = udpSocket.recvfrom(2048)
        cmd, data = unpackData(recData)
        #收到上线广播 将其转发到UI
        if cmd == 0:
            if recAddr[0] != HostIp:
                dataDict = {
                    "cmd":    0,
                    "avatar": data[:1],
                    "uid":    data[1:9],
                    "name":   data[9:],
                    "ip":     recAddr[0]
                }
                ipcSend(dataDict)
            else:
                pass
        #收到消息包 将其转发给UI
        elif cmd == 1:
            dataDict = {
            "cmd": 1,
            "uid": data[:8],
            "msg": data[8:]
            }
            ipcSend(dataDict)
        #收到上线广播确认包 将其发送给UI
        elif cmd == 2:
            dataDict = {
                "cmd":    2,
                "avatar": data[:1],
                "uid":    data[1:9],
                "name":   data[9:],
                "ip":     recAddr[0]
            }
            ipcSend(dataDict)
        #收到离线包 发送给UI
        elif cmd == 3:
            if recAddr[0] != HostIp: 
                dataDict = {
                    "cmd": 3,
                    #"uid": data[0:8]
                    "uid": data
                }
                ipcSend(dataDict)
            else:
                pass

        else:
            pass

#该函数与responseMsg 同理 将负责与UI通信的套接字接收到消息发送给python
#这里就buzaizhuishu

def ipc():
    while True:
        recData, recAddr = ipcSocket.recvfrom(2048)
        dataDict = unpackIpc(recData)
        cmd = dataDict["cmd"]
        if cmd == 0:
            avatar = dataDict["avatar"]
            uid =    dataDict["uid"]
            name =   dataDict["name"]
            data =   str(avatar) + uid + name
            broadcast(cmd,data, udpSocket)
        elif cmd == 1:
            uid = dataDict["uid"]
            msg = dataDict["msg"]
            ip =  dataDict["target"]
            data = uid + msg
            sendTo(1,ip,data,udpSocket)
        elif cmd == 2:
            avatar = dataDict["avatar"]
            uid = dataDict["uid"]
            name = dataDict["name"]
            ip = dataDict["target"]
            data = str(avatar) + uid +name
            sendTo(2,ip,data,udpSocket)
        elif cmd == 3:
            data = dataDict["uid"]
            #print("offline!", data)
            broadcast(cmd,data,udpSocket)
            #ipcSocket.close()
            #收到UI的退出消息 将singal置False 结束responseMsg进程 
            global singal
            singal = False
            sys.exit(0)
        else:
            pass

if __name__=="__main__":
    #创建监听python和UI线程
    t1 = Thread(target=responseMsg)
    t2 = Thread(target=ipc)
    #启动线程
    t1.start()
    t2.start()
