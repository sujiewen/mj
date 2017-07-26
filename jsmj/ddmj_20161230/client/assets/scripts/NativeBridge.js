var NBWXCallback =  function(data) {
    cc.log("NBWXCallback11:" + data);
    data = (data instanceof Object) ? data : eval("(" + data + ")");
    if (data.success == 0) {
        var u = data.userInfo;
        var ret = {};
        ret.errcode = 0;
        ret.account = u.unionId;
        ret.sign = u.unionId;
        cc.sys.localStorage.setItem("wx_account",u.unionId);
        cc.sys.localStorage.setItem("wx_sign",u.unionId);
        cc.vv.userMgr.onAuth(ret);
    }
    cc.log(data);
};
 
global.NBWXCallback = NBWXCallback;
