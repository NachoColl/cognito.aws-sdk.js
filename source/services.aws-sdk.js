var AWSConstants = {
    region: 'us-west-2'
    , cognitoEndpoint: 'cognito-idp.us-west-2.amazonaws.com'
    , userPoolId: 'us-west-2_YPTpsHBH2'
    , clientId: 'afc9gnnlvi3dbgtick3cve76s'
    , identityPoolId: 'us-west-2:89c94bea-2b40-4a16-af9b-e3f2287dbdd9'
    , S3LandingPageBucket: 'files.landingpage.services'
    , S3BaseTemplatesBucket: 'cdn.services'
    , cognitoApiGateway: 'https://8uzq72yjve.execute-api.us-west-2.amazonaws.com/v1/'
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
    UserPoolId: AWSConstants.userPoolId
    , ClientId: AWSConstants.clientId
});
/* for logged user */
var cognitoUser = null;
var token = null;
var refreshToken = null;
var email = null;
var password = null;
jQuery(function () {
    if (!(window.location.href.indexOf('index.html') > -1)) {
        token = Cookies.get('idToken');
        refreshToken = Cookies.get('refreshToken');
        if (!token || !refreshToken) AWSUtils.logout();
        else {
            // Initialize AWS SDK
            var logins = {};
            logins[AWSConstants.cognitoEndpoint + "/" + AWSConstants.userPoolId] = token;
            AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: AWSConstants.identityPoolId
                , Logins: logins
            });
            AWSUtils.refreshTokens();
            AWS.config.credentials.get(function (err) {
                if (err) console.log(err, err.stack);
                else {
                    if (typeof AWSPageInit !== 'undefined' && $.isFunction(AWSPageInit)) AWSPageInit();
                }
            });
        }
    }
});
var AWSUtils = function () {
    return {
        refreshTokens: function () {
            userPool.client.makeUnauthenticatedRequest('initiateAuth', {
                ClientId: AWSConstants.clientId
                , AuthFlow: 'REFRESH_TOKEN_AUTH'
                , AuthParameters: {
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
                            IdentityPoolId: AWSConstants.identityPoolId
                            , Logins: logins
                        })
                    });
                    AWS.config.credentials.get(function (err) {
                        if (err) console.log(err, err.stack);
                    });
                }
                else {
                    AWSUtils.logout();
                }
            });
            setTimeout(AWSUtils.refreshTokens, 3000000); // refresh after 50 minutes.
        }
        , logout: function () {
            Cookies.set('accessToken', '');
            Cookies.set('idToken', '');
            Cookies.set('refreshToken', '');
            if (cognitoUser != null) {
                cognitoUser.signOut();
                cognitoUser = null;
            }
            AWS.config.credentials.clearCachedId();
            if (typeof goHome !== 'undefined' && $.isFunction(goHome())) goHome();
            else window.location.href = "index.html";
        }
    };
}();
/****************************************************/
/* RegistrationForm, for *.services home pages. 	*/
/* HTML elements:									*/
/*	[inputs]										*/
/* 	- register-email								*/
/*  - register-password								*/
/*  - verify-code									*/
/*	[buttons]										*/
/*  - btn-register									*/
/*  - btn-verify									*/
/* 	- btn-verify-resend								*/
/****************************************************/
var RegistrationForm = function () {
    var initForm = function () {
        jQuery('.js-validation-register').validate({
            errorClass: 'help-block text-right animated fadeInDown'
            , errorElement: 'div'
            , errorPlacement: function (error, e) {
                jQuery(e).parents('.form-group > div').append(error);
            }
            , highlight: function (e) {
                jQuery(e).closest('.form-group').removeClass('has-error').addClass('has-error');
                jQuery(e).closest('.help-block').remove();
            }
            , success: function (e) {
                jQuery(e).closest('.form-group').removeClass('has-error');
                jQuery(e).closest('.help-block').remove();
            }
            , rules: {
                'register-email': {
                    required: true
                    , email: true
                }
                , 'register-password': {
                    required: true
                    , minlength: 6
                }
            }
            , messages: {
                'register-email': 'Please enter a valid email address'
                , 'register-password': {
                    required: 'Please provide a password'
                    , minlength: 'Your password must be at least 6 characters long'
                }
            }
        });
        jQuery('.js-validation-verify').validate({
            errorClass: 'help-block text-right animated fadeInDown'
            , errorElement: 'div'
            , errorPlacement: function (error, e) {
                jQuery(e).parents('.form-group > div').append(error);
            }
            , highlight: function (e) {
                jQuery(e).closest('.form-group').removeClass('has-error').addClass('has-error');
                jQuery(e).closest('.help-block').remove();
            }
            , success: function (e) {
                jQuery(e).closest('.form-group').removeClass('has-error');
                jQuery(e).closest('.help-block').remove();
            }
            , rules: {
                'verify-code': {
                    required: true
                }
            , }
            , messages: {
                'verify-code': {
                    required: 'Please provide a code'
                , }
            }
        });
        jQuery('#btn-register').on("click", function (e) {
            e.preventDefault();
            if (jQuery('.js-validation-register').valid() /* && myCaptchaResponse!=null */ ) {
                email = $('#register-email').val();
                password = $('#register-password').val();
                signup();
            }
            else ready();
        });
        jQuery('#btn-verify').on("click", function (e) {
            e.preventDefault();
            if (jQuery('.js-validation-verify').valid() /* && myCaptchaResponse!=null */ ) {
                verify($('#verify-code').val());
            }
            else ready();
        });
        jQuery('#btn-verify-resend').on("click", function (e) {
            e.preventDefault();
            resend();
            ready();
        });
    };

    function signup() {
        $('.Exception').hide();
        var attributeList = [];
        var dataEmail = {
            Name: 'email'
            , Value: email.toLowerCase()
        };
        var attributeEmail = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserAttribute(dataEmail);
        attributeList.push(attributeEmail);
        userPool.signUp(guid(), password, attributeList, null, function (err, result) {
            ready();
            if (err) {
                showRegistrationError(err);
                return;
            }
            cognitoUser = result.user;
            $('.registration').toggle();
        });
    }

    function verify(code) {
        $('.Exception').hide();
        cognitoUser.confirmRegistration(code, true, function (err, result) {
            ready();
            if (err) {
                showRegistrationError(err);
                return;
            }
            LoginForm.login();
        });
    }

    function resend() {
        $('.Exception').hide();
        cognitoUser.resendConfirmationCode(function (err, result) {
            ready();
            if (err) {
                showRegistrationError(err);
                return;
            }
            $('.register-codesent').show();
        });
    }

    function showRegistrationError(err) {
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
    }
    return {
        init: function () {
            initForm();
        }
    };
}();
/****************************************************/
/* LoginForm, for *.services home pages.  			*/
/* HTML elements:									*/
/*	[inputs]										*/
/* 	- login-username								*/
/*  - login-password								*/
/*	[buttons]										*/
/*  - btn-login										*/
/****************************************************/
var LoginForm = function () {
    var initForm = function () {
        jQuery('#btn-login').on("click", function (e) {
            e.preventDefault();
            if ($('#login-username').val() != '' && $('#login-password').val() != '') {
                email = $('#login-username').val();
                password = $('#login-password').val();
                signin();
            }
            else ready();
        });
        $("#login-password").keypress(function (e) {
            if ((e.which && e.which == 13) || (e.keyCode && e.keyCode == 13)) {
                $('#btn-login').click();
                return false;
            }
            else {
                return true;
            }
        });
    };

    function signin() {
        $('.Exception').hide();
        var authenticationData = {
            Username: email.toLowerCase()
            , Password: password
        , };
        var authenticationDetails = new AWSCognito.CognitoIdentityServiceProvider.AuthenticationDetails(authenticationData);
        var userData = {
            Username: email.toLowerCase()
            , Pool: userPool
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
                var refreshToken = new AWSCognito.CognitoIdentityServiceProvider.CognitoRefreshToken({
                    RefreshToken: result.refreshToken.token
                    , IdToken: result.idToken.jwtToken
                });
                if (typeof goInitialPage !== 'undefined' && $.isFunction(goInitialPage)) goInitialPage();
            }
            , onFailure: function (err) {
                showLoginError(err);
            }
        , });
    }

    function showLoginError(err) {
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
    }

    function showVerify() {
        $('#registration').hide();
        $('#verification').show();
        $('.how-to-use-title').hide();
        $('.how-to-use-form').show();
    }
    return {
        init: function () {
            initForm();
        }
        , login: function () {
            signin();
        }
    };
}();
/****************************************************/
/* ResetPasswordForm, for *.services home pages.  	*/
/* HTML elements:									*/
/*	[inputs]										*/
/* 	- email-recover									*/
/*  - password-recover								*/
/*  - code-recover									*/
/*	[buttons]										*/
/*  - btn-recover									*/
/*	- btn-confirm-recover							*/
/****************************************************/
var ResetPasswordForm = function () {
    var initForm = function () {
        // start reset.
        jQuery('.js-validation-reset').validate({
            errorClass: 'help-block text-right animated fadeInDown'
            , errorElement: 'div'
            , errorPlacement: function (error, e) {
                jQuery(e).parents('.form-group > div').append(error);
            }
            , highlight: function (e) {
                jQuery(e).closest('.form-group').removeClass('has-error').addClass('has-error');
                jQuery(e).closest('.help-block').remove();
            }
            , success: function (e) {
                jQuery(e).closest('.form-group').removeClass('has-error');
                jQuery(e).closest('.help-block').remove();
            }
            , rules: {
                'email-recover': {
                    required: true
                    , email: true
                }
            }
            , messages: {
                'email-recover': 'Please enter a valid email address'
            , }
        });
        jQuery('#btn-recover').on("click", function (e) {
            e.preventDefault();
            if ($('#email-recover').val() != '') {
                reset($('#email-recover').val());
            }
            else ready();
        });
        // confirm reset
        jQuery('.js-validation-reset-confirm').validate({
            errorClass: 'help-block text-right animated fadeInDown'
            , errorElement: 'div'
            , errorPlacement: function (error, e) {
                jQuery(e).parents('.form-group > div').append(error);
            }
            , highlight: function (e) {
                jQuery(e).closest('.form-group').removeClass('has-error').addClass('has-error');
                jQuery(e).closest('.help-block').remove();
            }
            , success: function (e) {
                jQuery(e).closest('.form-group').removeClass('has-error');
                jQuery(e).closest('.help-block').remove();
            }
            , rules: {
                'code-recover': {
                    required: true
                }
                , 'password-recover': {
                    required: true
                    , minlength: 6
                }
            }
            , messages: {
                'code-recover': {
                    required: 'Please provide a code'
                , }
                , 'password-recover': {
                    required: 'Please provide a new password'
                    , minlength: 'Your password must be at least 6 characters long'
                }
            }
        });
        jQuery('#btn-confirm-recover').on("click", function (e) {
            e.preventDefault();
            if ($('#email-recover').val() != '' && $('#code-recover').val() != '' && $('#password-recover').val() != '') {
                resetConfirm($('#email-recover').val(), $('#code-recover').val(), $('#password-recover').val());
            }
            else ready();
        });
    };

    function reset(e) {
        var json = {
            "email": e
        };
        $.ajax({
            method: 'POST'
            , url: 'https://tphxw0c862.execute-api.us-west-2.amazonaws.com/v1/user/reset'
            , data: JSON.stringify(json)
            , headers: {
                'Content-Type': 'application/json'
            }
            , dataType: 'json'
            , success: function (response) {
                ready();
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
            }
            , error: function (xhr, textStatus, errorThrown) {
                ready();
                $('.recover-UnexpectedException').show();
            }
        });
    }

    function resetConfirm(e, c, p) {
        var json = {
            "email": e
            , "code": c
            , "password": p
        };
        $.ajax({
            method: 'POST'
            , url: 'https://tphxw0c862.execute-api.us-west-2.amazonaws.com/v1/user/reset/confirm'
            , data: JSON.stringify(json)
            , headers: {
                'Content-Type': 'application/json'
            }
            , dataType: 'json'
            , success: function (response) {
                console.log(response);
                ready();
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
            }
            , error: function (xhr, textStatus, errorThrown) {
                ready();
                $('.recover-UnexpectedException').show();
            }
        });
    }
    return {
        init: function () {
            initForm();
        }
    };
}();
/****************************************************/
/* Template, for landingpage.services.  			*/
/****************************************************/
var Template = function () {
    var resultKO = function () {
        ready();
        showTemporaly('.UnexpectedException');
    };
    var call = function (method, params, callback, callbackError) {
        var resultOK = function (s) {
            switch (s.code) {
            case 0:
                if (callback !== 'undefined' && $.isFunction(callback)) callback(s);
                break;
            default:
                if (callbackError !== 'undefined' && $.isFunction(callbackError)) callbackError(s);
                else resultKO();
                break;
            }
        };
        json(params, method, resultOK, resultKO);
    };
    return {
        list: function (callback) {
            call('sitebuilder/template/list', null, callback);
        }
        , update: function (params, callback) {
            call('sitebuilder/template/update', params, callback);
        }
        , get: function (params, callback) {
            call('sitebuilder/template/get', params, callback);
        }
        , delete: function (params, callback, callbackError) {
            call('sitebuilder/template/delete', params, callback, callbackError);
        }
    }
}();
/****************************************************/
/* Page, for landingpage.services.  				*/
/****************************************************/
var Page = function () {
    var resultKO = function () {
        ready();
        $('.UnexpectedException').show();
    };
    var call = function (method, params, callback) {
        var resultOK = function (s) {
            switch (s.code) {
            case 0:
                if ($.isFunction(callback)) callback(s);
                break;
            default:
                resultKO();
                break;
            }
        };
        json(params, method, resultOK, resultKO);
    };
    return {
        list: function (callback) {
            call('sitebuilder/page/list', null, callback);
        }
        , update: function (params, callback) {
            call('sitebuilder/page/update', params, callback);
        }
        , get: function (params, callback) {
            call('sitebuilder/page/get', params, callback);
        }
        , delete: function (params, callback) {
            call('sitebuilder/page/delete', params, callback);
        }
    }
}();
/****************************************************/
/* Domains, for landingpage.services.  			    */
/****************************************************/
var Domains = function () {
    var resultKO = function () {
        ready();
        showTemporaly('.Domains-UnexpectedException');
    };
    var call = function (method, params, callback) {
        var resultOK = function (s) {
            switch (s.code) {
            case 0:
                if ($.isFunction(callback)) callback(s);
                else ready();
                break;
            default:
                resultKO();
                break;
            }
        };
        json(params, method, resultOK, resultKO);
    };
    return {
        list: function (pageGuid, callback) {
            var params = {};
            params.page = {
                guid: pageGuid
            };
            call('sitebuilder/domain/list', params, callback);
        }
        , update: function (pageGuid, pageName, domainName, isDefaultPage, callback) {
            var params = {};
            params.page = {
                guid: pageGuid
                , name: pageName
            };
            params.domain = {
                name: domainName
                , isDefault: isDefaultPage
            };
            call("sitebuilder/domain/update", params, callback);
        }
        , delete: function (pageGuid, pageName, domainName, callback) {
            var params = {};
            params.page = {
                guid: pageGuid
                , name: pageName
            };
            params.domain = {
                name: domainName
            };
            call("sitebuilder/domain/delete", params, callback);
        }
    }
}();
/****************************************************/
/* S3Images for landingpage.services   				*/
/****************************************************/
var S3Images = function () {
    var s3 = null;
    var listS3Images = function () {
        s3.listObjects({
            Prefix: AWS.config.credentials.identityId + '/assets/images'
        }, function (err, data) {
            if (err) {
                console.log(err);
            }
            else {
                var content = [];
                $('#S3Images-picker option').remove();
                $.each(data.Contents, function (index, object) {
                    $('#S3Images-picker').append('<option data-img-src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + object.Key + '" data-img-class = "img-responsive" value = "' + object.Key + '" /> ');
                });
                $("#S3Images-picker").imagepicker();
                $('#btn-image').show();
                ready();
            }
        });
    };
    var deleteS3Image = function (key) {
        s3.deleteObject({
            Key: key
        }, function (err, data) {
            if (err) {
                ready();
                console.log('There was an error deleting photo: ' + err.message);
            }
            listS3Images();
        });
    }
    var initInsertForm = function () {
        $('#insert-image-confirm').on("click", function (e) {
            e.preventDefault();
            if (typeof currentMustache !== 'undefined' && currentMustache !== null) currentMustache.replaceSelection('<img src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val() + '" />');
            else myCodeMirror.replaceSelection('<img src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val() + '" />');
            $('#insert-image').modal('hide');
            ready();
        });
        $('#insert-image-confirm-responsive').on("click", function (e) {
            e.preventDefault();
            if (typeof currentMustache !== 'undefined' && currentMustache !== null) currentMustache.replaceSelection('<img src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val() + '" class="img-responsive" />');
            else myCodeMirror.replaceSelection('<img src="https://s3-us-west-2.amazonaws.com/files.landingpage.services/' + $("#S3Images-picker").val() + '" class="img-responsive" />');
            $('#insert-image').modal('hide');
            ready();
        });
        $('#insert-image-delete').on("click", function (e) {
            e.preventDefault();
            if ($("#S3Images-picker").val()) S3Images.delete($("#S3Images-picker").val());
            else ready();
        });
        $('#cancel-insert-image').on("click", function (e) {
            e.preventDefault();
            ready();
        });
    };
    var initUploadForm = function () {
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
            var totalFiles = document.getElementById('image-upload-select').files.length;
            var uploaded = 0;
            $('#upload ul li').remove();
            $.each(document.getElementById('image-upload-select').files, function (index, file) {
                var tpl = $('<li class="working"><input type="text" value="0" data-width="48" data-height="48"' + ' data-fgColor="#0788a5" data-readOnly="1" data-bgColor="#3e4043" /><p></p><span></span></li>');
                // Append the file name and file size
                tpl.find('p').text(file.name).append('<i>' + formatFileSize(file.size) + '</i>');
                // Add the HTML to the UL element
                tpl.appendTo($('#upload ul'));
                // Initialize the knob plugin
                tpl.find('input').knob();
                var imageS3Key = AWS.config.credentials.identityId + '/assets/images/' + file.name.replace(/ /gi, "-");
                var request = s3.putObject({
                    Key: imageS3Key
                    , ContentType: file.type
                    , Body: file
                }, function (err, data) {
                    uploaded++;
                    if (uploaded == totalFiles) listS3Images();
                    if (err) {
                        tpl.addClass('error');
                        tpl.find('p').find('i').text('There was an error uploading your photo');
                        return console.log('There was an error uploading your photo: ', err.message);
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
        // Helper function that formats the file sizes
        function formatFileSize(bytes) {
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
        }
    };
    return {
        init: function () {
            s3 = new AWS.S3({
                apiVersion: '2006-03-01'
                , region: 'us-west-2'
                , params: {
                    Bucket: AWSConstants.S3LandingPageBucket
                }
            });
            initInsertForm();
            initUploadForm();
        }
        , list: function () {
            listS3Images();
        }
        , delete: function (key) {
            deleteS3Image(key);
        }
    }
}();
/****************************************************/
/* S3BaseTemplates for landingpage.services   		*/
/****************************************************/
var S3BaseTemplates = function () {
    var s3 = null;
    var selectedTemplateKey = null;
    var initInsertForm = function () {
        $('#btn-confirm-insert-template').on("click", function (e) {
            e.preventDefault();
            s3.getObject({
                Key: 'html-templates/' + selectedTemplateKey + '/' + selectedTemplateKey + '.html'
            }, function (getErr, getData) {
                if (getErr) console.log(getErr);
                else {
                    myCodeMirror.setValue(html_beautify(bin2String(getData.Body)));
                    $('#confirm-insert-template').modal('hide');
                    $('#insert-template').modal('hide');
                    myCodeMirror.focus();
                    ready();
                }
            });
        });
    };
    var listS3BaseTemplates = function () {
        s3.listObjects({
            Prefix: 'html-templates/'
            , Delimiter: '/'
        }, function (err, data) {
            if (err) {
                console.log(err);
            }
            else {
                $.each(data.Contents, function (index, object) {
                    if (typeof object.Key !== 'undefined') {
                        if (object.Key.endsWith("jpg")) {
                            var templateImage = object.Key.substr(object.Key.lastIndexOf('/') + 1);
                            var templateKey = templateImage.substr(0, templateImage.lastIndexOf('.'));
                            $('.templates-preview').append('<div class="col-lg-6 animated fadeIn" id="template-' + templateKey + '"><div class="img-container"><img class="img-responsive img-preview-template" src="https://s3-us-west-2.amazonaws.com/cdn.services/' + object.Key + '"><div class="img-options"><div class="img-options-content"><h3 class="font-w400 text-white push-5">' + object.Key + '</h3><h5 class="font-w400 text-white push-5"></h5><div class="push-20-t"><a class="btn btn-sm btn-default btn-noaction push-5-r" href="" target="_blank"><i class="fa fa-eye"></i> Preview</a><span class="btn btn-sm btn-danger btn-noaction" data-toggle="modal" data-target="#confirm-insert-template" data-backdrop="static"  onclick="S3BaseTemplates.select(\'' + templateKey + '\')"><i class="fa fa-hand-pointer-o"></i> Select</span></div></div></div></div></div>');
                            s3.getObject({
                                Key: 'html-templates/' + templateKey + '/' + templateKey + '.txt'
                            }, function (getErr, getData) {
                                if (getErr) console.log(getErr);
                                else {
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
    };
    var bin2String = function (array) {
        var result = "";
        for (var i = 0; i < array.length; i++) {
            result += String.fromCharCode(array[i]);
        }
        return result;
    }
    return {
        init: function () {
            s3 = new AWS.S3({
                apiVersion: '2006-03-01'
                , region: 'us-west-2'
                , params: {
                    Bucket: AWSConstants.S3BaseTemplatesBucket
                }
            });
            initInsertForm();
        }
        , list: function () {
            listS3BaseTemplates();
        }
        , select: function (name) {
            selectedTemplateKey = name;
        }
    }
}();