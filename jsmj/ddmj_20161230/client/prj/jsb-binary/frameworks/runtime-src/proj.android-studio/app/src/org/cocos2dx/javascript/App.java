package org.cocos2dx.javascript;

import android.app.Application;

import com.umeng.socialize.Config;
import com.umeng.socialize.PlatformConfig;
import com.umeng.socialize.UMShareAPI;
import com.umeng.socialize.common.QueuedWork;

/**
 * Created by Sjw on 2017/7/27.
 */

public class App extends Application {
    @Override
    public void onCreate() {

        super.onCreate();

        //59795d6fae1bf84599002380
        //开启debug模式，方便定位错误，具体错误检查方式可以查看http://dev.umeng.com/social/android/quick-integration的报错必看，正式发布，请关闭该模式
//        Config.DEBUG = true;
//        QueuedWork.isUseThreadPool = false;
//        UMShareAPI.get(this);
    }

    //各个平台的配置，建议放在全局Application或者程序入口
    {
//        PlatformConfig.setWeixin("wx7e735bb9a4bec219", "bbceacc6e2c197a4d616d84c4ae3aef3");
    }
}
