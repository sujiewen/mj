//
//  XBBaseViewController.m
//  XTeacher
//
//  Created by TD on 4/2/15.
//  Copyright (c) 2015 TD. All rights reserved.
//

#import <Foundation/Foundation.h>

#define  CODE_KEY                @"RC_UI_UE_UN_UG_UB_US_UC_UZ_UM_RC"

@interface NSString (Extension)

+ (id)stringWithDate:(NSDate*)date format:(NSString *)format;

- (NSString *)urlEncoding;
- (NSString *)urlDecoding;


- (NSString *)base64decode;
- (NSString*)base64encode;

- (NSString*)URLJavaEncodedString;
- (NSString*)URLEncodedString;
- (NSString*)URLDecodedString;
- (NSString*)subSpace;

+ (NSString*) DESEncrypt:(NSString *)source;
+ (NSString*) DESDecrypt:(NSString *)source;

- (NSData *)dataWithBase64EncodedString;
+ (NSString *)base64EncodedStringFrom:(NSData *)data;


@end
