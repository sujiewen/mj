//
//  WXAuthUtil.m
//  DDMJ
//
//  Created by Sjw on 2017/7/25.
//
//

#import "WXAuthUtil.h"
#include "cocos2d.h"
#include <iostream>
#include <vector>
#include <map>
#include <string>
//#include "CCUMSocialSDK.h"
#include "scripting/js-bindings/manual/ScriptingCore.h"
#include "UShareUI/UMSocialUIUtility.h"
#include "UShareUI/UShareUI.h"
#include "MJExtension/MJExtension.h"
#include "NSString+Extension.h"

USING_NS_CC;

//USING_NS_UM_SOCIAL;

static NSString *wxLoginCallback = @"WXLoginCallback";

@implementation WXAuthUtil

+(void)login:(NSString *)funcName {
    if (funcName != nil && funcName.length > 0) {
        wxLoginCallback = [[NSString alloc] initWithString:funcName];
    }
    
    [[UMSocialManager defaultManager] getUserInfoWithPlatform:UMSocialPlatformType_WechatSession currentViewController:nil completion:^(id result, NSError *error) {
        
        NSMutableDictionary *dictMsg = [NSMutableDictionary new];
        
        if (error) {
            NSString *message = [NSString stringWithFormat:@"Get info fail:\n%@", error];
            UMSocialLogInfo(@"Get info fail with error %@",error);
            
            [dictMsg setObject:@(1) forKey:@"success"];
            [dictMsg setObject:@(1) forKey:@"code"];
            [dictMsg setObject:[message URLEncodedString] forKey:@"errMsg"];
        }else{
            if ([result isKindOfClass:[UMSocialUserInfoResponse class]]) {
                
                UMSocialUserInfoResponse *resp = result;
                [dictMsg setObject:@(0) forKey:@"success"];
                NSDictionary *dictO =  [WXAuthUtil authInfoDict:resp];
                [dictMsg setObject:dictO forKey:@"userInfo"];
            }else{
                NSString *message = @"Get info fail";
                [dictMsg setObject:@(1) forKey:@"success"];
                [dictMsg setObject:@(2) forKey:@"code"];
                [dictMsg setObject:[message URLEncodedString] forKey:@"errMsg"];
            }
        }
        
        NSData *tmpData = [NSJSONSerialization dataWithJSONObject:dictMsg options:0 error:nil];
        NSString *jsonStr = [[NSString alloc] initWithBytes:[tmpData bytes] length:[tmpData length] encoding:NSUTF8StringEncoding];
        
        jsonStr = [jsonStr stringByReplacingOccurrencesOfString:@"\\" withString:@"\\\\"];
        jsonStr = [jsonStr stringByReplacingOccurrencesOfString:@"\"" withString:@"\\\""];
        jsonStr = [jsonStr stringByReplacingOccurrencesOfString:@"\'" withString:@"\\\'"];
        jsonStr = [jsonStr stringByReplacingOccurrencesOfString:@"\n" withString:@"\\n"];
        jsonStr = [jsonStr stringByReplacingOccurrencesOfString:@"\r" withString:@"\\r"];
        jsonStr = [jsonStr stringByReplacingOccurrencesOfString:@"\f" withString:@"\\f"];
        jsonStr = [jsonStr stringByReplacingOccurrencesOfString:@"\u2028" withString:@"\\u2028"];
        jsonStr = [jsonStr stringByReplacingOccurrencesOfString:@"\u2029" withString:@"\\u2029"];
        
        std::string jsCallStr = cocos2d::StringUtils::format("%s(\"%s\");",wxLoginCallback.UTF8String, jsonStr.UTF8String);
        ScriptingCore::getInstance()->evalString(jsCallStr.c_str());
    }];
}

+ (NSMutableDictionary *)authInfoDict:(UMSocialUserInfoResponse *)resp
{
    NSMutableDictionary *dict = [NSMutableDictionary new];
    if (resp.uid) {
        [dict setObject:resp.uid forKey:@"uid"];
    }
    if (resp.openid) {
        [dict setObject:resp.openid forKey:@"openid"];
    }
    if (resp.unionId) {
        [dict setObject:resp.unionId forKey:@"unionId"];
    }
    if (resp.usid) {
        [dict setObject:resp.usid forKey:@"usid"];
    }
    if (resp.accessToken) {
        [dict setObject:resp.accessToken forKey:@"accessToken"];
    }
    if (resp.refreshToken) {
        [dict setObject:resp.refreshToken forKey:@"refreshToken"];
    }
    if (resp.expiration) {
        NSDateFormatter *fmt = [[NSDateFormatter alloc] init];
        fmt.dateFormat = @"yyyy-MM-dd HH:mm:ss";
        [dict setObject:[fmt stringFromDate:resp.expiration] forKey:@"expiration"];
    }
    if (resp.name) {
        [dict setObject:[resp.name URLEncodedString] forKey:@"name"];
    }
    if (resp.iconurl) {
        [dict setObject:resp.iconurl forKey:@"iconurl"];
    }
    if (resp.unionGender) {
        [dict setObject:[resp.unionGender URLEncodedString] forKey:@"unionGender"];
    }
    
    if (resp.gender) {
        [dict setObject:resp.gender forKey:@"gender"];
    }
    
    return dict;
}

@end
