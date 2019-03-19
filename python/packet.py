#!usr/bin/env python
#-*-coding:utf-8-*-
#author:lim time:2018/4/30


from struct import *
import json
import time

def packData(cmd, string, mark=233):
    # 封装数据包
    bytestring = bytes(string, encoding='utf-8')
    length = len(bytestring)
    str_pack = pack('!iii%ds' % length, mark, cmd, length, bytestring)
    return str_pack


def unpackData(string):
    # 解析数据包
    mark, cmd, length = unpack('!iii', string[0:12])
    byteData = unpack('{length}s'.format(length=length), string[12:12 + length])[0]
    data = str(byteData, encoding='utf-8')
    return cmd,data

def packIpc(d):
    jsonStr = json.dumps(d)
    return jsonStr

def unpackIpc(jsonStr):
    d = json.loads(jsonStr)
    return d

