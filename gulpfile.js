var   path    = require('path'),
      gulp    = require('gulp'),
      gutil   = require('gulp-util'),
      uglify  = require('gulp-uglify'),
      rename  = require("gulp-rename"),
      replace = require('gulp-string-replace'),
      jslint  = require('gulp-jslint'),
      pump    = require('pump');

gulp.task('compress', function (cb) {
  pump([
        gulp.src(path.resolve(__dirname, './') + '/src/*.js'),
        /*
        jslint(),
        jslint.reporter('default'),*/
        uglify(),
        rename({ suffix: '.min' }),
        gulp.dest(path.resolve(__dirname, './') + '/dist/')
    ],
    cb
  );
});

gulp.task('update-readme', function (cb) {
  gutil.log(process.env.TRAVIS_BUILD_NUMBER);
  pump([
        gulp.src(path.resolve(__dirname, './') + '/README.md'),
        replace(new RegExp('https:\/\/d2m9ia44cpx81c\.cloudfront\.net\/js\/services\/(?:\d*)\/services\.library\.min\.js', 'g'), 'https://d2m9ia44cpx81c.cloudfront.net/js/services/' + process.env.TRAVIS_BUILD_NUMBER + '/services.library.min.js'),
        gulp.dest(path.resolve(__dirname, './'))
    ],
    cb
  );
});

