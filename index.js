var fs = require('fs');
var AWS = require('aws-sdk');
var _ = require('lodash');
var STATIC_BUCKET;
var ORIGIN_BUCKET;
var serverUpload;
var serverStorage;
var s3;

module.exports.initBuckets = function (options) {
  s3 = new AWS.S3(options);
  STATIC_BUCKET = options.STATIC_BUCKET;
  ORIGIN_BUCKET = options.ORIGIN_BUCKET;
  serverUpload = options.host;
  serverStorage = options.storageHost;
  module.exports.listBuckets(function (error, result) {
    if (error)
      return console.error(error);
    _.map([STATIC_BUCKET, ORIGIN_BUCKET], function (item) {
      var index = _.findIndex(result.Buckets, {Name: item});
      if (index === -1) {
        module.exports.createBuckets(item, function (error, result) {
          console.log(error, result)
        })
      }
      else console.log(item + "bucket had existed")
    })
  })
};

module.exports.listBuckets = function (done) {
  s3.listBuckets(done)
};

module.exports.preparePut = function (options, data) {
  var date = new Date().getTime();
  _.map(data, function (item) {
    var fileExtension = item.filename.split('.');
    var name = module.exports.strToSlug(fileExtension.join(''));
    item.bucket = options.type || 'static';
    item.createdBy = options.createdBy;
    item.env = options.env;
    item.ext = fileExtension.pop();
    item.name = fileExtension.join('');
    item.parentId = options.parentId;
    item.key = options.prefix + '/' + name + '_' + date + '.' + item.ext || 'images' + '/' + name + '_' + date + '.' + item.ext;
    if (item.bucket === 'origin') {
      item.key = "origin/" + item.key;
      item.uri = serverStorage + item.key
    }
    item.uri = serverStorage + item.key;
    return item
  });
  return data
};

module.exports.getBucketOptions = function (type) {
  var data = {};
  switch (type) {
    case 'origin':
      return data = {
        bucket: ORIGIN_BUCKET,
        acl: 'private'
      };
      break;
    default :
      return data = {
        bucket: STATIC_BUCKET,
        acl: 'public-read'
      }
  }
};

module.exports.putObject = function (data, done) {
  var putObject = function (item, cb) {
    var bucketOptions = module.exports.getBucketOptions(data.bucket);
    var params = {
      Bucket: bucketOptions.bucket,
      ACL: bucketOptions.acl,
      Key: item.key,
      Body: fs.createReadStream(item.fd)
    };
    s3.putObject(params, function (error, result) {
      try {
        if (fs.existsSync(item.fd))
          fs.unlinkSync(item.fd)
      }
      catch (e) {}
      return cb(error, result)
    })
  };

  async.eachSeries(data, putObject, function (error, result) {
    return done(error, data)
  })
};

module.exports.listObjects = function (done) {
  var params = {
    Bucket: STATIC_BUCKET,
    EncodingType: 'url',
    MaxKeys: 2,
    Prefix: 'images/'
  };
  return s3.listObjectsV2(params, done);
};

module.exports.createBuckets = function (name, done) {
  if (!name)
    return done('Name must not be empty', null);
  var params = {
    Bucket: name
  };
  s3.createBucket(params, function (error, data) {
    if (error)
      console.log(error);
    return done(error, data)
  })
};

module.exports.strToSlug = function (str) {
  if (typeof str !== 'string' || str.length < 1)
    return ''
  str = str
  //Trim string
      .replace(/^\s+|\s+$/g, '')
      //Covert string to lower
      .toLowerCase()
      //Replace for character 'a'
      .replace(/[áàảãạäăắằẳẵặâấầẩẫậ]/g, 'a')
      //Replace for character 'e'
      .replace(/[éèẻẽẹëêếềểễệ]/g, 'e')
      //Replace for character 'i'
      .replace(/[íìỉĩịïî]/g, 'i')
      //Replace for character 'o'
      .replace(/[óòỏõọöơớờởỡợôốồổỗộ]/g, 'o')
      //Replace for character 'u'
      .replace(/[úùủũụüûưứừửữự]/g, 'u')
      //Replace for character 'c'
      .replace(/[ç]/g, 'c')
      //Replace for character 'd'
      .replace(/[đ]/g, 'd')
      //Replace for character 'n'
      .replace(/[ñ]/g, 'n')
      //Replace for special
      .replace(/[.·\/_,:;\\| +\s]/g, '-')
      .replace(/[^a-z0-9 -]/g, '');
  return str;
};