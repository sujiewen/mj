cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
    },

    login: function () {
        if (cc.sys.isNative) {
            var ret;
            switch (cc.sys.os) {
                case cc.sys.OS_ANDROID:
                        ret = jsb.reflection.callStaticMethod("org/cocos2dx/javascript/AppActivity", "login", "()V");
                        break;
                case cc.sys.OS_IOS:
                        ret = jsb.reflection.callStaticMethod("WXAuthUtil", "login:", "NBWXCallback");
                        break;
            }
            cc.log("微信登录--" + ret);
        }
    }       

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});
