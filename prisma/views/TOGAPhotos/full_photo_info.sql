SELECT
  `p`.`id` AS `id`,
  `p`.`status` AS `status`,
  `p`.`queue` AS `queue`,
  `p`.`message` AS `message`,
  `p`.`screener_1` AS `screener_1`,
  `p`.`screener_2` AS `screener_2`,
  `p`.`need_screener_2` AS `need_screener_2`,
  `p`.`result` AS `result`,
  `p`.`reason` AS `reason`,
  `p`.`screener_message` AS `screener_message`,
  `p`.`upload_user_id` AS `upload_user_id`,
  `TOGAPhotos`.`user`.`username` AS `username`,
  `p`.`ac_type` AS `ac_type`,
  `p`.`ac_reg` AS `ac_reg`,
  `p`.`ac_msn` AS `ac_msn`,
  `p`.`airline` AS `airline`,
  `p`.`airport_id` AS `airport_id`,
  `p`.`pic_type` AS `pic_type`,
  `p`.`user_remark` AS `user_remark`,
  `p`.`photo_time` AS `photo_time`,
  `p`.`exif` AS `exif`,
  `p`.`upload_time` AS `upload_time`,
  `a`.`airport_cn` AS `airport_cn`,
  `a`.`airport_en` AS `airport_en`,
  `a`.`icao_code` AS `airport_icao_code`,
  `a`.`iata_code` AS `airport_iata_code`
FROM
  (
    (
      `TOGAPhotos`.`photo` `p`
      JOIN `TOGAPhotos`.`airport` `a` ON((`p`.`airport_id` = `a`.`id`))
    )
    JOIN `TOGAPhotos`.`user` ON(
      (`p`.`upload_user_id` = `TOGAPhotos`.`user`.`id`)
    )
  )
WHERE
  (`p`.`is_delete` = 0)