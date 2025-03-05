SELECT
  `TOGAPhotos`.`full_photo_info`.`id` AS `id`,
  `TOGAPhotos`.`full_photo_info`.`upload_user_id` AS `upload_user_id`,
  `TOGAPhotos`.`full_photo_info`.`username` AS `username`,
  `TOGAPhotos`.`full_photo_info`.`ac_type` AS `ac_type`,
  `TOGAPhotos`.`full_photo_info`.`ac_reg` AS `ac_reg`,
  `TOGAPhotos`.`full_photo_info`.`ac_msn` AS `ac_msn`,
  `TOGAPhotos`.`full_photo_info`.`airline` AS `airline`,
  `TOGAPhotos`.`full_photo_info`.`airport_id` AS `airport_id`,
  `TOGAPhotos`.`full_photo_info`.`pic_type` AS `pic_type`,
  `TOGAPhotos`.`full_photo_info`.`user_remark` AS `user_remark`,
  `TOGAPhotos`.`full_photo_info`.`photo_time` AS `photo_time`,
  `TOGAPhotos`.`full_photo_info`.`upload_time` AS `upload_time`,
  `TOGAPhotos`.`full_photo_info`.`airport_cn` AS `airport_cn`,
  `TOGAPhotos`.`full_photo_info`.`airport_en` AS `airport_en`,
  `TOGAPhotos`.`full_photo_info`.`airport_icao_code` AS `airport_icao_code`,
  `TOGAPhotos`.`full_photo_info`.`airport_iata_code` AS `airport_iata_code`
FROM
  `TOGAPhotos`.`full_photo_info`
WHERE
  (
    `TOGAPhotos`.`full_photo_info`.`status` = 'ACCEPT'
  )