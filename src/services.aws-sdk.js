/*jslint browser: true, devel: true, white: true, plusplus: true */
/*global
$,AWS,AWSCognito,
Cookies,json,html_beautify,bin2String,
AWSPageInit,goInitialPage,showRegistrationError,showTemporaly,
currentMustache,myCodeMirror,
Utils
*/
var AWSConstants = {
  region: 'us-west-2',
  cognitoEndpoint: 'cognito-idp.us-west-2.amazonaws.com',
  userPoolId: 'us-west-2_YPTpsHBH2',
  clientId: 'afc9gnnlvi3dbgtick3cve76s',
  identityPoolId: 'us-west-2:89c94bea-2b40-4a16-af9b-e3f2287dbdd9',
  S3LandingPageBucket: 'files.landingpage.services',
  S3SendMailPageBucket: 'files.sendmail.services',
  S3BaseTemplatesBucket: 'cdn.services',
  cognitoApiGateway: 'https://8uzq72yjve.execute-api.us-west-2.amazonaws.com/v1/'
};
/* Initialize AWS SDK global configs */
AWS.config.region = AWSConstants.region;
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: AWSConstants.identityPoolId
});
AWSCognito.config.region = AWSConstants.region;
AWSCognito.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: AWSConstants.identityPoolId
});
var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool({
  UserPoolId: AWSConstants.userPoolId,
  ClientId: AWSConstants.clientId
});
/* for logged user */
var cognitoUser = null,
  email = null,
  password = null,
  token = Cookies.get('idToken'),
  refreshToken = Cookies.get('refreshToken');

var AWSUtils = (function () {
  "use strict";
  return {
    refreshTokens: function () {
      userPool.client.makeUnauthenticatedRequest('initiateAuth', {
        ClientId: AWSConstants.clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          "REFRESH_TOKEN": refreshToken
        }
      }, function (err, authResult) {
        if (!err) {
          Cookies.set('accessToken', authResult.AuthenticationResult.AccessToken);
          Cookies.set('idToken', authResult.AuthenticationResult.IdToken);
          var logins = {};
          logins[AWSConstants.cognitoEndpoint + "/" + AWSConstants.userPoolId] = authResult.AuthenticationResult.IdToken;
          AWS.config.update({
            credentials: new AWS.CognitoIdentityCredentials({
              IdentityPoolId: AWSConstants.identityPoolId,
              Logins: logins
            })
          });
          AWS.config.credentials.get(function (err) {
            if (err) {
              console.log(err, err.stack);
            }
          });
        } else {
          AWSUtils.logout();
        }
      });
      setTimeout(AWSUtils.refreshTokens, 3000000); // refresh after 50 minutes.
    },
    logout: function () {
      Cookies.set('accessToken', '');
      Cookies.set('idToken', '');
      Cookies.set('refreshToken', '');
      if (cognitoUser !== null) {
        cognitoUser.signOut();
        cognitoUser = null;
      }
      AWS.config.credentials.clearCachedId();
      if (typeof Utils.goHome !== 'undefined' && $.isFunction(Utils.goHome())) {
        Utils.goHome();
      } else {
        window.location.href = "index.html";
      }
    },
    initializePageAuthentication: function (pageException) {
      if (window.location.href.indexOf(pageException) <= 0) {
        if (!token || !refreshToken) {
          AWSUtils.logout();
        } else {
          // Initialize AWS SDK
          var logins = {};
          logins[AWSConstants.cognitoEndpoint + "/" + AWSConstants.userPoolId] = token;
          AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: AWSConstants.identityPoolId,
            Logins: logins
          });
          AWSUtils.refreshTokens();
          AWS.config.credentials.get(function (err) {
            if (err) {
              console.log(err, err.stack);
            } else {
              if (typeof AWSPageInit !== 'undefined' && $.isFunction(AWSPageInit)) {
                AWSPageInit();
              }
            }
          });
        }
      }
    }
  };
}());

$(function () {
  "use strict";

  // check if running on localhost (DEV)
  if (!(location.hostname === "localhost" || location.hostname === "127.0.0.1"))
    AWSUtils.initializePageAuthentication('index.html');
});

/****************************************************/
/* RegistrationForm, for *.services home pages.     */
/* HTML elements:									*/
/*	[inputs]										*/
/*  - register-email								*/
/*  - register-password								*/
/*  - verify-code									*/
/*	[buttons]										*/
/*  - btn-register									*/
/*  - btn-verify									*/
/*  - btn-verify-resend								*/
/****************************************************/
var RegistrationForm = (function () {
  "use strict";
  var signupCallBack = null,
    confirmCallback = null,
    signup = function () {
      $('.Exception').hide();
      var attributeList = [],
        dataEmail = {
          Name: 'email',
          Value: email.toLowerCase()
        },
        attributeEmail = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserAttribute(dataEmail);
      attributeList.push(attributeEmail);
      userPool.signUp(Utils.newGuid(), password, attributeList, null, function (err, result) {
        Utils.ready();
        if (err) {
          showRegistrationError(err);
          return;
        }
        cognitoUser = result.user;
        $('.registration').toggle();

        if (typeof signupCallBack !== 'undefined' && $.isFunction(signupCallBack)) {
          signupCallBack();
        }
      });
    },
    verify = function (code) {
      $('.Exception').hide();
      cognitoUser.confirmRegistration(code, true, function (err, result) {
        Utils.ready();
        if (err) {
          showRegistrationError(err);
          return;
        }
        if (typeof confirmCallback !== 'undefined' && $.isFunction(confirmCallback)) {
          confirmCallback();
        }
        LoginForm.login();
      });
    },
    resend = function () {
      $('.Exception').hide();
      cognitoUser.resendConfirmationCode(function (err, result) {
        Utils.ready();
        if (err) {
          showRegistrationError(err);
          return;
        }
        $('.register-codesent').show();
      });
    },
    showRegistrationError = function (err) {
      switch (err.code) {
        case "InvalidParameterException":
          $('.register-InvalidParameterException').show();
          break;
        case "UsernameExistsException":
          $('.register-UsernameExistsException').show();
          break;
        case "CodeMismatchException":
          $('.register-CodeMismatchException').show();
          break;
        case "UserLambdaValidationException":
          $('.register-UsernameExistsException').show();
          break;
        default:
          $('.register-UnexpectedException').show();
          break;
      }
    },
    initForm = function () {
      $('.js-validation-register').validate({
        errorClass: 'help-block text-right animated fadeInDown',
        errorElement: 'div',
        errorPlacement: function (error, e) {
          $(e).parents('.form-group > div').append(error);
        },
        highlight: function (e) {
          $(e).closest('.form-group').removeClass('has-error').addClass('has-error');
          $(e).closest('.help-block').remove();
        },
        success: function (e) {
          $(e).closest('.form-group').removeClass('has-error');
          $(e).closest('.help-block').remove();
        },
        rules: {
          'register-email': {
            required: true,
            email: true
          },
          'register-password': {
            required: true,
            minlength: 6
          }
        },
        messages: {
          'register-email': 'Please enter a valid email address',
          'register-password': {
            required: 'Please provide a password',
            minlength: 'Your password must be at least 6 characters long'
          }
        }
      });
      $('.js-validation-verify').validate({
        errorClass: 'help-block text-right animated fadeInDown',
        errorElement: 'div',
        errorPlacement: function (error, e) {
          $(e).parents('.form-group > div').append(error);
        },
        highlight: function (e) {
          $(e).closest('.form-group').removeClass('has-error').addClass('has-error');
          $(e).closest('.help-block').remove();
        },
        success: function (e) {
          $(e).closest('.form-group').removeClass('has-error');
          $(e).closest('.help-block').remove();
        },
        rules: {
          'verify-code': {
            required: true
          }
        },
        messages: {
          'verify-code': {
            required: 'Please provide a code'
          }
        }
      });
      $('#btn-register').on("click", function (e) {
        e.preventDefault();
        if ($('.js-validation-register').valid() /* && myCaptchaResponse!=null */ ) {
          email = $('#register-email').val();
          password = $('#register-password').val();
          signup();
        } else {
          Utils.ready();
        }
      });
      $('#btn-verify').on("click", function (e) {
        e.preventDefault();
        if ($('.js-validation-verify').valid() /* && myCaptchaResponse!=null */ ) {
          verify($('#verify-code').val());
        } else {
          Utils.ready();
        }
      });
      $('#btn-verify-resend').on("click", function (e) {
        e.preventDefault();
        resend();
        Utils.ready();
      });
    };
  return {
    init: function (callBack1, callback2) {
      signupCallBack = callBack1;
      confirmCallback = callback2;
      initForm();
    }
  };
}());
/****************************************************/
/* LoginForm, for *.services home pages.            */
/* HTML elements:									*/
/*	[inputs]										*/
/*  - login-username								*/
/*  - login-password								*/
/*  [buttons]										*/
/*  - btn-login										*/
/****************************************************/
var LoginForm = (function () {
  "use strict";
  var initForm = function () {
      $('#btn-login').on("click", function (e) {
        e.preventDefault();
        if ($('#login-username').val() !== '' && $('#login-password').val() !== '') {
          email = $('#login-username').val();
          password = $('#login-password').val();
          signin();
        } else {
          Utils.ready();
        }
      });
      $("#login-password").keypress(function (e) {
        if ((e.which && e.which === 13) || (e.keyCode && e.keyCode === 13)) {
          $('#btn-login').click();
          return false;
        } else {
          return true;
        }
      });
    },
    showVerify = function () {
      $('#registration').hide();
      $('#verification').show();
      $('.how-to-use-title').hide();
      $('.how-to-use-form').show();
    },
    showLoginError = function (err) {
      switch (err.code) {
        case "UserNotFoundException":
        case "NotAuthorizedException":
          $('.login-UserNotFoundException').show();
          break;
        case "UserNotConfirmedException":
        case "PasswordResetRequiredException":
          $('.login-UserNotConfirmedException').show();
          showVerify();
          break;
        default:
          $('.login-UnexpectedException').show();
          break;
      }

    },
    signin = function () {
      $('.Exception').hide();
      var authenticationData = {
          Username: email.toLowerCase(),
          Password: password
        },
        authenticationDetails = new AWSCognito.CognitoIdentityServiceProvider.AuthenticationDetails(authenticationData),
        userData = {
          Username: email.toLowerCase(),
          Pool: userPool
        };
      cognitoUser = new AWSCognito.CognitoIdentityServiceProvider.CognitoUser(userData);
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function (result) {
          /*	Use the idToken for Logins Map when Federating User Pools with
              Cognito Identity or when passing through an Authorization Header to an API
              Gateway Authorizer
          */
          Cookies.set('accessToken', result.getAccessToken().getJwtToken());
          Cookies.set('idToken', result.idToken.jwtToken);
          Cookies.set('refreshToken', result.refreshToken.token);
          refreshToken = new AWSCognito.CognitoIdentityServiceProvider.CognitoRefreshToken({
            RefreshToken: result.refreshToken.token,
            IdToken: result.idToken.jwtToken
          });
          if (typeof goInitialPage !== 'undefined' && $.isFunction(goInitialPage)) {
            goInitialPage();
          }
        },
        onFailure: function (err) {
          showLoginError(err);
          Utils.ready();
        }
      });
    };
  return {
    init: function () {
      initForm();
    },
    login: function () {
      signin();
    }
  };
}());
/****************************************************/
/* ResetPasswordForm, for *.services home pages.    */
/* HTML elements:									*/
/*	[inputs]										*/
/*  - email-recover									*/
/*  - password-recover								*/
/*  - code-recover									*/
/*  [buttons]										*/
/*  - btn-recover									*/
/*  - btn-confirm-recover							*/
/****************************************************/
var ResetPasswordForm = (function () {
  "use strict";
  var initForm = function () {
      // start reset.
      $('.js-validation-reset').validate({
        errorClass: 'help-block text-right animated fadeInDown',
        errorElement: 'div',
        errorPlacement: function (error, e) {
          $(e).parents('.form-group > div').append(error);
        },
        highlight: function (e) {
          $(e).closest('.form-group').removeClass('has-error').addClass('has-error');
          $(e).closest('.help-block').remove();
        },
        success: function (e) {
          $(e).closest('.form-group').removeClass('has-error');
          $(e).closest('.help-block').remove();
        },
        rules: {
          'email-recover': {
            required: true,
            email: true
          }
        },
        messages: {
          'email-recover': 'Please enter a valid email address'
        }
      });
      $('#btn-recover').on("click", function (e) {
        e.preventDefault();
        if ($('#email-recover').val() !== '') {
          reset($('#email-recover').val());
        } else {
          Utils.ready();
        }
      });
      // confirm reset
      $('.js-validation-reset-confirm').validate({
        errorClass: 'help-block text-right animated fadeInDown',
        errorElement: 'div',
        errorPlacement: function (error, e) {
          $(e).parents('.form-group > div').append(error);
        },
        highlight: function (e) {
          $(e).closest('.form-group').removeClass('has-error').addClass('has-error');
          $(e).closest('.help-block').remove();
        },
        success: function (e) {
          $(e).closest('.form-group').removeClass('has-error');
          $(e).closest('.help-block').remove();
        },
        rules: {
          'code-recover': {
            required: true
          },
          'password-recover': {
            required: true,
            minlength: 6
          }
        },
        messages: {
          'code-recover': {
            required: 'Please provide a code'
          },
          'password-recover': {
            required: 'Please provide a new password',
            minlength: 'Your password must be at least 6 characters long'
          }
        }
      });
      $('#btn-confirm-recover').on("click", function (e) {
        e.preventDefault();
        if ($('#email-recover').val() !== '' && $('#code-recover').val() !== '' && $('#password-recover').val() !== '') {
          resetConfirm($('#email-recover').val(), $('#code-recover').val(), $('#password-recover').val());
        } else {
          Utils.ready();
        }
      });
    },
    reset = function (e) {
      var json = {
        "email": e
      };
      $.ajax({
        method: 'POST',
        url: 'https://tphxw0c862.execute-api.us-west-2.amazonaws.com/v1/user/reset',
        data: JSON.stringify(json),
        headers: {
          'Content-Type': 'application/json'
        },
        dataType: 'json',
        success: function (response) {
          Utils.ready();
          switch (response.code) {
            case -2:
              $('.recover-UserNotFound').show();
              break;
            case -3:
              switch (response.error.code) {
                case 'LimitExceededException':
                  $('.recover-LimitExeeded').show();
                  break;
                default:
                  $('.recover-UnexpectedException').show();
                  break;
              }
              break;
            case 0:
              $('.recover-steps').toggle();
              break;
            default:
              $('.recover-UnexpectedException').show();
              break;
          }
        },
        error: function (xhr, textStatus, errorThrown) {
          Utils.ready();
          $('.recover-UnexpectedException').show();
        }
      });
    },
    resetConfirm = function (e, c, p) {
      var json = {
        "email": e,
        "code": c,
        "password": p
      };
      $.ajax({
        method: 'POST',
        url: 'https://tphxw0c862.execute-api.us-west-2.amazonaws.com/v1/user/reset/confirm',
        data: JSON.stringify(json),
        headers: {
          'Content-Type': 'application/json'
        },
        dataType: 'json',
        success: function (response) {
          console.log(response);
          Utils.ready();
          switch (response.code) {
            case -2:
              $('.recover-UserNotFound').show();
              break;
            case -3:
              switch (response.error.code) {
                case 'LimitExceededException':
                  $('.recover-LimitExeeded').show();
                  break;
                case 'CodeMismatchException':
                  $('.recover-InvalidCode').show();
                  break;
                default:
                  $('.recover-UnexpectedException').show();
                  break;
              }
              break;
            case 0:
              email = e;
              password = p;
              LoginForm.login();
              break;
            default:
              $('.recover-UnexpectedException').show();
              break;
          }
        },
        error: function (xhr, textStatus, errorThrown) {
          Utils.ready();
          $('.recover-UnexpectedException').show();
        }
      });
    };
  return {
    init: function () {
      initForm();
    }
  };
}());
/****************************************************/
/* User                                             */
/****************************************************/
var User = (function () {
  'use strict';
  var resultKO = function () {
      Utils.ready();
      Utils.showTemporaly('.UnexpectedException');
    },
    call = function (method, params, callback, callbackError) {
      var resultOK = function (s) {
        switch (s.code) {

          case 0:
            if (callback !== 'undefined' && $.isFunction(callback)) {
              callback(s);
            }
            break;
          default:
            if (callbackError !== 'undefined' && $.isFunction(callbackError)) {
              callbackError(s);
            } else {
              resultKO();
            }
            break;
        }
      };
      Utils.apiJsonCall(params, method, resultOK, resultKO);
    },
    APIKey = null,
    seller = null,
    email = null,
    CANSPAMStatus = 0,
    CANSPAMData = null,
    mailingCredits = null,
    mailingCount = 0,
    getUserCredits = function (data) {
      if (data.MAILING_CREDITS) {
        mailingCredits = data.MAILING_CREDITS;
      }
      if (data.MAILING_COUNT) {
        mailingCount = data.MAILING_COUNT;
      }
    },
    smtpSent = 0,
    smtpDelivered = 0,
    smtpTransientBounces = 0,
    smtpBounces = 0,
    smtpComplaints = 0,
    getUserSMTPStats = function (data) {
      if (data.SMTP_SENT) {
        smtpSent = data.SMTP_SENT;
      }
      if (data.SMTP_DELIVERY) {
        smtpDelivered = data.SMTP_DELIVERY;
      }
      if (data.SMTP_TRANSIENT_BOUNCE) {
        smtpTransientBounces = data.SMTP_TRANSIENT_BOUNCE;
      }
      if (data.SMTP_BOUNCE) {
        smtpBounces = data.SMTP_BOUNCE;
      }
      if (data.SMTP_COMPLAINT) {
        smtpComplaints = data.SMTP_COMPLAINT;
      }
    },
    getUserData = function (callback) {
      var resultKO = function () {
          APIKey = null;
          $('.apikey').html('');
          email = null;
          $('.email').html('');
          seller = null;
          $('.seller').html('');
          mailingCANSPAM = null;
          $('.apikey-UnexpectedException').show();
          Utils.ready();
        },
        resultOK = function (s) {
          switch (s.code) {
            case 0:
              APIKey = s.data.API_KEY;
              $('.apikey').html(s.data.API_KEY);
              email = s.data.EMAIL;
              $('.email').html(s.data.EMAIL);
              if (s.data.SELLER) {
                seller = JSON.parse(s.data.SELLER);
                $('.seller').html(s.data.SELLER);
              }
              if (s.data.CANSPAM_STATUS) {
                CANSPAMStatus = JSON.parse(s.data.CANSPAM_STATUS);
              }
              if (s.data.CANSPAM_DATA) {
                CANSPAMData = JSON.parse(s.data.CANSPAM_DATA);
              }
              getUserCredits(s.data);
              getUserSMTPStats(s.data);
              if ($.isFunction(callback)) {
                callback();
              } else {
                Utils.ready();
              }
              break;
            default:
              resultKO();
              break;
          }
        };
      Utils.apiJsonCall(null, 'user/get', resultOK, resultKO);
    };

  return {
    init: function (callback) {
      getUserData(callback);
    },
    getEmail: function () {
      return email;
    },
    getSeller: function () {
      return seller;
    },
    getCANSPAMStatus: function () {
      return CANSPAMStatus;
    },
    getCANSPAMData: function () {
      return CANSPAMData;
    },
    getAPIKey: function () {
      return APIKey;
    },
    getMailingStats: function () {
      return {
        "mailCredits": mailingCredits,
        "mailCount": mailingCount
      };
    },
    getSMTPStats: function () {
      return {
        "smtpSent": smtpSent,
        "smtpDelivered": smtpDelivered,
        "smtpTransientBounces": smtpTransientBounces,
        "smtpBounces": smtpBounces,
        "smtpComplaints": smtpComplaints
      };
    },
    setCANSPAMData: function (params, callback, callbackError) {
      call('user/update/canspam', params, callback, callbackError);
    }
  };
}());
/****************************************************/
/* Contact                                          */
/****************************************************/
var Contact = (function () {
  "use strict";
  var resultKO = function () {
      Utils.ready();
      Utils.showTemporaly('.UnexpectedException');
    },
    call = function (method, params, callback, callbackError) {
      var resultOK = function (s) {
        switch (s.code) {

          case 0:
            if (callback !== 'undefined' && $.isFunction(callback)) {
              callback(s);
            }
            break;
          default:
            if (callbackError !== 'undefined' && $.isFunction(callbackError)) {
              callbackError(s);
            } else {
              resultKO();
            }
            break;
        }
      };
      Utils.apiJsonCall(params, method, resultOK, resultKO);
    };
  return {
    list: function (callback) {
      call('contact/list', null, callback);
    },
    search: function (params, callback) {
      call('contact/list', params, callback);
    },
    update: function (params, callback, callbackError) {
      call('contact/update', params, callback, callbackError);
    },
    get: function (email, callback) {
      var params = {
        contact: {
          email: email
        }
      };
      call('contact/get', params, callback);
    },
    remove: function (params, callback) {
      call('contact/delete', params, callback);
    },
    load: function (params, callback, callbackError) {
      call('contact/import', params, callback, callbackError);
    },
    listAttributes: function (callback, callbackError) {
      var params = {};
      call('contact/attribute/list', params, callback, callbackError);
    },
    updateTargetGroup: function (params, callback, callbackError) {
      call('contact/target-group/update', params, callback, callbackError);
    },
    listTargetGroups: function (callback, callbackError) {
      var params = {};
      call('contact/target-group/list', params, callback, callbackError);
    },
    addAttribute: function (params, callback, callbackError) {
      call('contact/attribute/add', params, callback, callbackError);
    }
  };
}());
/****************************************************/
/* EMAILS                                           */
/****************************************************/
var Email = (function () {
  "use strict";
  var resultKO = function () {
      Utils.ready();
      Utils.showTemporaly('.UnexpectedException');
    },
    call = function (method, params, callback, callbackError) {
      var resultOK = function (s) {
        switch (s.code) {
          case 0:
            if (callback !== 'undefined' && $.isFunction(callback)) {
              callback(s);
            }
            break;
          default:
            if (callbackError !== 'undefined' && $.isFunction(callbackError)) {
              callbackError(s);
            } else {
              resultKO();
            }
            break;
        }
      };
      Utils.apiJsonCall(params, method, resultOK, resultKO);
    };
  return {
    list: function (callback, callbackError) {
      call('mailing/email/list', null, callback, callbackError);
    },
    get: function (params, callback, callbackError) {
      call('mailing/email/get', params, callback, callbackError);
    }
  };
}());
/****************************************************/
/* Mailing Campaign                                 */
/****************************************************/
var Campaign = (function () {
  "use strict";
  var resultKO = function () {
      Utils.ready();
      Utils.showTemporaly('.UnexpectedException');
    },
    call = function (method, params, callback, callbackError) {
      var resultOK = function (s) {
        switch (s.code) {
          case 0:
            if (callback !== 'undefined' && $.isFunction(callback)) {
              callback(s);
            }
            break;
          default:
            if (callbackError !== 'undefined' && $.isFunction(callbackError)) {
              callbackError(s);
            } else {
              resultKO();
            }
            break;
        }
      };
      Utils.apiJsonCall(params, method, resultOK, resultKO);
    };
  return {
    list: function (callback) {
      call('mailing/campaign/list', null, callback);
    },
    update: function (params, callback, callbackError) {
      call('mailing/campaign/update', params, callback, callbackError);
    },
    get: function (campaignId, callback) {
      var params = {
        campaign: {
          campaignId: campaignId
        }
      };
      call('mailing/campaign/get', params, callback);
    },
    remove: function (params, callback) {
      call('mailing/campaign/delete', params, callback);
    },
    test: function (params, callback) {
      call('mailing/campaign/test', params, callback);
    },
    start: function (campaignId, callback) {
      var params = {
        campaign: {
          campaignId: campaignId
        }
      };
      call('mailing/campaign/start', params, callback);
    },
    stop: function (campaignId, callback) {
      var params = {
        campaign: {
          campaignId: campaignId
        }
      };
      call('mailing/campaign/stop', params, callback);
    },
    log: function (campaignId, callback) {
      var params = {
        campaign: {
          campaignId: campaignId
        }
      };
      call('mailing/campaign/log', params, callback);
    },
    status: function (campaignId, callback) {
      var params = {
        campaign: {
          campaignId: campaignId
        }
      };
      call('mailing/campaign/status', params, callback);
    }
  };
}());
/****************************************************/
/* MAILING Template                                 */
/****************************************************/
var MailingTemplate = (function () {
  "use strict";
  var resultKO = function () {
      Utils.ready();
      Utils.showTemporaly('.UnexpectedException');
    },
    call = function (method, params, callback, callbackError) {
      var resultOK = function (s) {
        switch (s.code) {
          case 0:
            if (callback !== 'undefined' && $.isFunction(callback)) {
              callback(s);
            }
            break;
          default:
            if (callbackError !== 'undefined' && $.isFunction(callbackError)) {
              callbackError(s);
            } else {
              resultKO();
            }
            break;
        }
      };
      Utils.apiJsonCall(params, method, resultOK, resultKO);
    };
  return {
    list: function (callback, callbackError) {
      call('mailing/template/list', null, callback, callbackError);
    },
    update: function (params, callback) {
      call('mailing/template/update', params, callback);
    },
    get: function (params, callback) {
      call('mailing/template/get', params, callback);
    },
    remove: function (params, callback, callbackError) {
      call('mailing/template/delete', params, callback, callbackError);
    }
  };
}());
/****************************************************/
/* MAILING Statistics.                              */
/****************************************************/
var MailingStats = (function () {
  "use strict";
  var resultKO = function () {
      Utils.ready();
      Utils.showTemporaly('.UnexpectedException');
    },
    call = function (method, params, callback, callbackError) {
      var resultOK = function (s) {
        switch (s.code) {
          case 0:
          case -2:
            if (callback !== 'undefined' && $.isFunction(callback)) {
              callback(s);
            }
            break;
          default:
            if (callbackError !== 'undefined' && $.isFunction(callbackError)) {
              callbackError(s);
            } else {
              resultKO();
            }
            break;
        }
      };
      Utils.apiJsonCall(params, method, resultOK, resultKO);
    };
  return {
    getUserCounters: function (params, callback, callbackError) {
      call('mailing/stats/user', params, callback, callbackError);
    }
  };
}());
/****************************************************/
/* WEB Template                                     */
/****************************************************/
var Template = (function () {
  "use strict";
  var resultKO = function () {
      Utils.ready();
      Utils.showTemporaly('.UnexpectedException');
    },
    call = function (method, params, callback, callbackError) {
      var resultOK = function (s) {
        switch (s.code) {
          case 0:
            if (callback !== 'undefined' && $.isFunction(callback)) {
              callback(s);
            }
            break;
          default:
            if (callbackError !== 'undefined' && $.isFunction(callbackError)) {
              callbackError(s);
            } else {
              resultKO();
            }
            break;
        }
      };
      Utils.apiJsonCall(params, method, resultOK, resultKO);
    };
  return {
    list: function (callback) {
      call('sitebuilder/template/list', null, callback);
    },
    update: function (params, callback) {
      call('sitebuilder/template/update', params, callback);
    },
    get: function (params, callback) {
      call('sitebuilder/template/get', params, callback);
    },
    remove: function (params, callback, callbackError) {
      call('sitebuilder/template/delete', params, callback, callbackError);
    }
  };
}());
/****************************************************/
/* Page, for landingpage.services.                  */
/****************************************************/
var Page = (function () {
  "use strict";
  var resultKO = function () {
      Utils.ready();
      $('.UnexpectedException').show();
    },
    call = function (method, params, callback) {
      var resultOK = function (s) {
        switch (s.code) {
          case 0:
            if ($.isFunction(callback)) {
              callback(s);
            }
            break;
          default:
            resultKO();
            break;
        }
      };
      Utils.apiJsonCall(params, method, resultOK, resultKO);
    };
  return {
    list: function (callback) {
      call('sitebuilder/page/list', null, callback);
    },
    update: function (params, callback) {
      call('sitebuilder/page/update', params, callback);
    },
    get: function (params, callback) {
      call('sitebuilder/page/get', params, callback);
    },
    remove: function (params, callback) {
      call('sitebuilder/page/delete', params, callback);
    }
  };
}());
/****************************************************/
/* Domains, for landingpage.services.               */
/****************************************************/
var Domains = (function () {
  "use strict";
  var resultKO = function () {
      Utils.ready();
      Utils.showTemporaly('.Domains-UnexpectedException');
    },
    call = function (method, params, callback) {
      var resultOK = function (s) {
        switch (s.code) {
          case 0:
            if ($.isFunction(callback)) {
              callback(s);
            } else {
              Utils.ready();
            }
            break;
          default:
            resultKO();
            break;
        }
      };
      Utils.apiJsonCall(params, method, resultOK, resultKO);
    };
  return {
    list: function (pageGuid, callback) {
      var params = {};
      params.page = {
        guid: pageGuid
      };
      call('sitebuilder/domain/list', params, callback);
    },
    update: function (pageGuid, pageName, domainName, isDefaultPage, callback) {
      var params = {};
      params.page = {
        guid: pageGuid,
        name: pageName
      };
      params.domain = {
        name: domainName,
        isDefault: isDefaultPage
      };
      call("sitebuilder/domain/update", params, callback);
    },
    remove: function (pageGuid, pageName, domainName, callback) {
      var params = {};
      params.page = {
        guid: pageGuid,
        name: pageName
      };
      params.domain = {
        name: domainName
      };
      call("sitebuilder/domain/delete", params, callback);
    }
  };
}());
/****************************************************/
/* Invoicing                                        */
/****************************************************/
var Invoicing = (function () {
  "use strict";
  var resultKO = function () {
      Utils.ready();
      Utils.showTemporaly('.UnexpectedException');
    },
    call = function (method, params, callback, callbackError) {
      var resultOK = function (s) {
        switch (s.code) {
          case 0:
            if (callback !== 'undefined' && $.isFunction(callback)) {
              callback(s);
            }
            break;
          default:
            if (callbackError !== 'undefined' && $.isFunction(callbackError)) {
              callbackError(s);
            } else {
              resultKO();
            }
            break;
        }
      };
      Utils.apiJsonCall(params, method, resultOK, resultKO);
    };
  return {
    getDashBoard: function (query, callback, callbackError) {
      call('invoicing/dashboard/get', query, callback, callbackError);
    }
  };
}());
/****************************************************/
/* S3Images for *.services                          */
/****************************************************/
var S3Images = (function () {
  "use strict";
  var s3 = null,
    options = null,
    listS3Images = function () {
      s3.listObjects({
        Prefix: AWS.config.credentials.identityId + '/assets/images'
      }, function (err, data) {
        if (err) {
          console.log(err);
        } else {
          $('#S3Images-picker option').remove();
          $.each(data.Contents, function (index, object) {
            $('#S3Images-picker').append('<option data-img-src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + object.Key + '" data-img-class = "img-responsive" value = "' + object.Key + '" /> ');
          });
          $("#S3Images-picker").imagepicker();
          $('#btn-image').show();
          Utils.ready();
        }
      });
    },
    deleteS3Image = function (key) {
      s3.deleteObject({
        Key: key
      }, function (err, data) {
        if (err) {
          Utils.ready();
          console.log('There was an error deleting photo: ' + err.message);
        }
        listS3Images();
      });
    },
    initInsertForm = function () {

      if (options && options.insertUrl) {
        // we just insert the link href, not the img tag.
        $('#insert-image-options').hide();
        $('#insert-image-confirm-link').on("click", function (e) {
          e.preventDefault();
          if (options && options.mustaches) {
            options.mustaches.getCurrentMustache().replaceSelection('https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val());
          } else if (options && options.editor) {
            options.editor.getTextArea().replaceSelection('https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val());
          } else {
            myCodeMirror.replaceSelection('https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val());
          }
          $('#insert-image').modal('hide');
          Utils.ready();
        });
      } else {
        $('#insert-image-confirm-link').on("click", function (e) {
          e.preventDefault();
          if (options && options.mustaches) {
            options.mustaches.getCurrentMustache().replaceSelection('https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val());
          } else if (options && options.editor) {
            options.editor.getTextArea().replaceSelection('https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val());
          } else {
            myCodeMirror.replaceSelection('https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val());
          }
          $('#insert-image').modal('hide');
          Utils.ready();
        });
        $('#insert-image-confirm').on("click", function (e) {
          e.preventDefault();
          if (options && options.mustaches) {
            options.mustaches.getCurrentMustache().replaceSelection('<img src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val() + '" />');
          } else if (options && options.editor) {
            options.editor.getTextArea().replaceSelection('<img src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val() + '" />');
          } else {
            myCodeMirror.replaceSelection('<img src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val() + '" />');
          }
          $('#insert-image').modal('hide');
          Utils.ready();
        });
        $('#insert-image-confirm-responsive').on("click", function (e) {
          e.preventDefault();
          if (options && options.mustaches) {
            options.mustaches.getCurrentMustache().replaceSelection('<img src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val() + '" class="img-responsive" />');
          } else if (options && options.editor) {
            options.editor.getTextArea().replaceSelection('<img src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val() + '" class="img-responsive" />');
          } else {
            myCodeMirror.replaceSelection('<img src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val() + '" class="img-responsive" />');
          }
          $('#insert-image').modal('hide');
          Utils.ready();
        });
      }
      $('#insert-image-delete').on("click", function (e) {
        e.preventDefault();
        if ($("#S3Images-picker").val()) {
          S3Images.remove($("#S3Images-picker").val());
        } else {
          Utils.ready();
        }
      });
      $('#cancel-insert-image').on("click", function (e) {
        e.preventDefault();
        Utils.ready();
      });
      $('#insert-image').on('shown.bs.modal', function () {
        if (options && options.mustaches) {
          switch (options.mustaches.getCurrentMustacheType()) {
            case 'image':
              $('#insert-image-confirm-link').hide();
              $('.insert-image-tag').show();
              break;
            case 'imagesrc':
              $('#insert-image-confirm-link').show();
              $('.insert-image-tag').hide();
              break;
          }
        }
      });

    },
    // Helper function that formats the file sizes
    formatFileSize = function (bytes) {
      if (typeof bytes !== 'number') {
        return '';
      }
      if (bytes >= 1000000000) {
        return (bytes / 1000000000).toFixed(2) + ' GB';
      }
      if (bytes >= 1000000) {
        return (bytes / 1000000).toFixed(2) + ' MB';
      }
      return (bytes / 1000).toFixed(2) + ' KB';
    },
    initUploadForm = function () {
      $('#drop a').click(function () {
        // Simulate a click on the file input button
        // to show the file browser dialog
        $(this).parent().find('input').click();
      });
      $('#drop').on('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('#drop').addClass('dragover');
      });
      $('#drop').on('dragleave', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('#drop').removeClass('dragover');
      });
      $('#drop').on('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('#drop').removeClass('dragover');
        document.getElementById('image-upload-select').files = e.originalEvent.dataTransfer.files;
      });
      $("#image-upload-select").change(function () {
        var totalFiles = document.getElementById('image-upload-select').files.length,
          uploaded = 0;
        $('#upload ul li').remove();
        $.each(document.getElementById('image-upload-select').files, function (index, file) {
          var tpl = $('<li class="working"><input type="text" value="0" data-width="48" data-height="48"' + ' data-fgColor="#0788a5" data-readOnly="1" data-bgColor="#3e4043" /><p></p><span></span></li>');
          // Append the file name and file size
          tpl.find('p').text(file.name).append('<i>' + formatFileSize(file.size) + '</i>');
          // Add the HTML to the UL element
          tpl.appendTo($('#upload ul'));
          // Initialize the knob plugin
          tpl.find('input').knob();
          var imageS3Key = AWS.config.credentials.identityId + '/assets/images/' + file.name.replace(/ /gi, "-"),
            request = s3.putObject({
              Key: imageS3Key,
              ContentType: file.type,
              Body: file
            });

          request.on('success', function (response) {
            uploaded++;
            if (uploaded === totalFiles) {
              listS3Images();
            }
            if (response.error) {
              tpl.addClass('error');
              tpl.find('p').find('i').text('There was an error uploading your photo');
              return console.log('There was an error uploading your photo: ', response.error);
            }
          });


          request.on('httpUploadProgress', function (progress) {
            var percent = parseInt(progress.loaded / progress.total * 100, 10);
            tpl.find('input').val(percent).change();
          });
          request.send();
        });
      });
      // Prevent the default action when a file is dropped on the window
      $(document).on('drop dragover', function (e) {
        e.preventDefault();
      });

    };
  return {
    init: function (o) {
      options = o;
      s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        region: 'us-west-2',
        params: {
          Bucket: AWSConstants.S3LandingPageBucket
        }
      });
      initInsertForm();
      initUploadForm();
    },
    list: function () {
      listS3Images();
    },
    remove: function (key) {
      deleteS3Image(key);
    }
  };
}());
/****************************************************/
/*  S3BaseTemplates for landingpage.services        */
/****************************************************/
var S3BaseTemplates = (function () {
  "use strict";
  var s3 = null,
    basePath = 'html-templates/',
    onSelect = null,
    codemirror = null,
    selectedTemplateKey = null,
    initInsertForm = function () {
      /* default button */
      $('#btn-confirm-insert-template').on("click", function (e) {
        e.preventDefault();
        s3.getObject({
          Key: basePath + selectedTemplateKey + '/' + selectedTemplateKey + '.html'
        }, function (getErr, getData) {
          if (getErr) {
            console.log(getErr);
            $('.UnexpectedException').show();
          } else {
            codemirror.setValue(html_beautify(bin2String(getData.Body)));
            $('#confirm-insert-template').modal('hide');
            $('#insert-template').modal('hide');
            codemirror.focus();
            Utils.ready();
          }
        });
      });
    },
    listS3BaseTemplates = function () {
      s3.listObjects({
        Prefix: basePath,
        Delimiter: '/'
      }, function (err, data) {
        if (err) {
          console.log(err);
        } else {
          $.each(data.Contents, function (index, object) {
            if (typeof object.Key !== 'undefined') {
              if (object.Key.endsWith("jpg")) {
                var templateImage = object.Key.substr(object.Key.lastIndexOf('/') + 1),
                  templateKey = templateImage.substr(0, templateImage.lastIndexOf('.'));
                $('.templates-preview').append('<div class="col-lg-6 animated fadeIn" id="template-' + templateKey + '"><div class="img-container"><img class="img-responsive img-preview-template" src="https://s3-us-west-2.amazonaws.com/cdn.services/' + object.Key + '"><div class="img-options"><div class="img-options-content"><h3 class="font-w400 text-white push-5">' + object.Key + '</h3><h5 class="font-w400 text-white push-5"></h5><div class="push-20-t"><a class="btn btn-sm btn-default btn-noaction push-5-r" href="" target="_blank"><i class="fa fa-eye"></i> Preview</a><span class="btn btn-sm btn-danger btn-noaction" data-toggle="modal" data-target="#confirm-insert-template" data-backdrop="static"  onclick="S3BaseTemplates.select(\'' + templateKey + '\',\'' + object.Key + '\')"><i class="fa fa-hand-pointer-o"></i> Select</span></div></div></div></div></div>');
                s3.getObject({
                  Key: basePath + templateKey + '/' + templateKey + '.txt'
                }, function (getErr, getData) {
                  if (getErr) {
                    console.log(getErr);
                  } else {
                    var templateData = bin2String(getData.Body).split('\n');
                    $('#template-' + templateKey + ' .img-options-content h3').html(templateData[0]);
                    $('#template-' + templateKey + ' .img-options-content h5').html(templateData[1]);
                    $('#template-' + templateKey + ' .img-options-content a').attr('href', templateData[2]);
                  }
                });
              }
            }
          });
          $('#select-base-template').show();
        }
      });
    },
    bin2String = function (array) {
      var result = "",
        i;
      for (i = 0; i < array.length; i++) {
        result += String.fromCharCode(array[i]);
      }
      return result;
    };
  return {
    init: function (path, onSelectCallback, textArea) {

      s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        region: 'us-west-2',
        params: {
          Bucket: AWSConstants.S3BaseTemplatesBucket
        }
      });

      if (path) {
        basePath = path;
      }
      if (onSelectCallback) {
        onSelect = onSelectCallback;
      }
      codemirror = textArea;

      initInsertForm();
    },
    list: function () {
      listS3BaseTemplates();
    },
    select: function (name, objectKey) {
      selectedTemplateKey = name;
      if (onSelect !== 'undefined' && $.isFunction(onSelect)) {
        onSelect(name, objectKey);
      }
    },
    getSelectedTemplateKey: function () {
      return selectedTemplateKey;
    },
    getSelectedTemplateHTML: function (callback) {
      s3.getObject({
        Key: basePath + selectedTemplateKey + '/' + selectedTemplateKey + '.html'
      }, function (getErr, getData) {
        if (getErr) {
          console.log(getErr);
          $('.UnexpectedException').show();
        } else {
          callback(bin2String(getData.Body));
        }
      });
    }

  };
}());
/****************************************************/
/*  S3ImportCSV                                      */
/****************************************************/
var S3Services = (function () {
  "use strict";
  var s3 = null,
    initS3 = function (bucket) {
      s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        region: 'us-west-2',
        params: {
          Bucket: bucket
        }
      });
    },
    uploadFile = function (file, path, fileName, callback, callbackProgress, callbackError) {
      var fileKey = AWS.config.credentials.identityId + path + fileName.replace(/ /gi, "-"),
        request = s3.putObject({
          Key: fileKey,
          ContentType: file.type,
          Body: file
        });

      request.on('httpUploadProgress', function (progress) {
        var percent = parseInt(progress.loaded / progress.total * 100, 10);
        if ($.isFunction(callbackProgress)) {
          callbackProgress(percent);
        }
      });

      request.on('success', function (response) {
        if (response.error) {
          if ($.isFunction(callbackError)) {
            callbackError(response.error);
          }
        } else {
          if ($.isFunction(callback)) {
            callback(response.data);
          }
        }
      });

      request.send();
    };

  return {
    init: function (bucket) {
      initS3(bucket);
    },
    upload: function (file, path, fileName, callback, callbackProgress, callbackError) {
      uploadFile(file, path, fileName, callback, callbackProgress, callbackError);
    }
  };

}());
