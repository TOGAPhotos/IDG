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
  `TOGAPhotos_v2`.`user`.`username` AS `username`,
  `p`.`ac_type` AS `ac_type`,
  `p`.`ac_reg` AS `ac_reg`,
  `p`.`ac_msn` AS `ac_msn`,
  `p`.`airline_id` AS `airline_id`,
  `p`.`airport_id` AS `airport_id`,
  `p`.`pic_type` AS `pic_type`,
  `p`.`user_remark` AS `user_remark`,
  `p`.`photo_time` AS `photo_time`,
  `p`.`exif` AS `exif`,
  `p`.`upload_time` AS `upload_time`,
  `a`.`airport_cn` AS `airport_cn`,
  `a`.`airport_en` AS `airport_en`,
  `a`.`icao_code` AS `airport_icao_code`,
  `a`.`iata_code` AS `airport_iata_code`,
  `TOGAPhotos_v2`.`airline`.`airline_cn` AS `airline_cn`,
  `TOGAPhotos_v2`.`airline`.`airline_en` AS `airline_en`,
  `TOGAPhotos_v2`.`airline`.`icao_code` AS `airline_icao_code`,
  `TOGAPhotos_v2`.`airline`.`iata_code` AS `airline_iata_code`
FROM
  (
    (
      (
        `TOGAPhotos_v2`.`photo` `p`
        LEFT JOIN `TOGAPhotos_v2`.`airport` `a` ON((`p`.`airport_id` = `a`.`id`))
      )
      LEFT JOIN `TOGAPhotos_v2`.`user` ON(
        (
          `p`.`upload_user_id` = `TOGAPhotos_v2`.`user`.`id`
        )
      )
    )
    LEFT JOIN `TOGAPhotos_v2`.`airline` ON(
      (
        `p`.`airline_id` = `TOGAPhotos_v2`.`airline`.`id`
      )
    )
  )
WHERE
  (`p`.`is_delete` = 0)