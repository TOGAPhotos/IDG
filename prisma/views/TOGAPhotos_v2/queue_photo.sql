SELECT
  `TOGAPhotos_v2`.`full_photo_info`.`id` AS `id`,
  `TOGAPhotos_v2`.`full_photo_info`.`status` AS `status`,
  `TOGAPhotos_v2`.`full_photo_info`.`queue` AS `queue`,
  `TOGAPhotos_v2`.`full_photo_info`.`message` AS `message`,
  `TOGAPhotos_v2`.`full_photo_info`.`screener_1` AS `screener_1`,
  `TOGAPhotos_v2`.`full_photo_info`.`screener_2` AS `screener_2`,
  `TOGAPhotos_v2`.`full_photo_info`.`reason` AS `reason`,
  `TOGAPhotos_v2`.`full_photo_info`.`screener_message` AS `screener_message`,
  `TOGAPhotos_v2`.`full_photo_info`.`upload_user_id` AS `upload_user_id`,
  `TOGAPhotos_v2`.`full_photo_info`.`username` AS `username`,
  `TOGAPhotos_v2`.`full_photo_info`.`ac_type` AS `ac_type`,
  `TOGAPhotos_v2`.`full_photo_info`.`ac_reg` AS `ac_reg`,
  `TOGAPhotos_v2`.`full_photo_info`.`ac_msn` AS `ac_msn`,
  `TOGAPhotos_v2`.`full_photo_info`.`airline_id` AS `airline_id`,
  `TOGAPhotos_v2`.`full_photo_info`.`airline_cn` AS `airline_cn`,
  `TOGAPhotos_v2`.`full_photo_info`.`airline_en` AS `airline_en`,
  `TOGAPhotos_v2`.`full_photo_info`.`airline_icao_code` AS `airline_icao_code`,
  `TOGAPhotos_v2`.`full_photo_info`.`airline_iata_code` AS `airline_iata_code`,
  `TOGAPhotos_v2`.`full_photo_info`.`airport_id` AS `airport_id`,
  `TOGAPhotos_v2`.`full_photo_info`.`pic_type` AS `pic_type`,
  `TOGAPhotos_v2`.`full_photo_info`.`user_remark` AS `user_remark`,
  `TOGAPhotos_v2`.`full_photo_info`.`photo_time` AS `photo_time`,
  `TOGAPhotos_v2`.`full_photo_info`.`upload_time` AS `upload_time`,
  `TOGAPhotos_v2`.`full_photo_info`.`airport_cn` AS `airport_cn`,
  `TOGAPhotos_v2`.`full_photo_info`.`airport_en` AS `airport_en`,
  `TOGAPhotos_v2`.`full_photo_info`.`airport_icao_code` AS `airport_icao_code`,
  `TOGAPhotos_v2`.`full_photo_info`.`airport_iata_code` AS `airport_iata_code`
FROM
  `TOGAPhotos_v2`.`full_photo_info`
WHERE
  (
    (
      `TOGAPhotos_v2`.`full_photo_info`.`status` <> 'ACCEPT'
    )
    AND (
      `TOGAPhotos_v2`.`full_photo_info`.`status` <> 'REJECT'
    )
  )