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
  pump([
        gulp.src(path.resolve(__dirname, './') + '/README.md'),
        replace(new RegExp('<script.*?src="(.*?)"', 'g'), 'production'),
        gulp.dest(path.resolve(__dirname, './'))
    ],
    cb
  );
});

