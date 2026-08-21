
const multer = require("multer");
const multerS3 = require("multer-s3");
const config = require("./config")
const s3 = require("./s3");

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: config.aws.bucketName,
    acl: 'public-read',
    key: (req, file, cb) => {
      cb( null, `records/${Date.now()}-${file.originalname}` );
    },
  }),
});


module.exports = upload;