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

    // use this for initialization
    onLoad: function () {

    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});


function NBWXCallback(data) {
    cc.log("NBWXCallback:" + data);
    data = (data instanceof Object) ? data : eval("(" + data + ")");
    if (data.success == 0) {
        var u = data.userInfo;
        setUser(u.unionId, u.name, u.iconurl, u.gender);
    }
    cc.log(data);
}
