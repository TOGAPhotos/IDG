SELECT
  `TOGAPhotos`.`photo_queue`.`queue_id` AS `queue_id`,
  `TOGAPhotos`.`photo_queue`.`photo_id` AS `photo_id`,
  `TOGAPhotos`.`photo_queue`.`queue_type` AS `queue_type`,
  `TOGAPhotos`.`photo_queue`.`status` AS `status`,
  `TOGAPhotos`.`photo_queue`.`message_to_screener` AS `message_to_screener`,
  `TOGAPhotos`.`photo_queue`.`screener_1` AS `screener_1`,
  `TOGAPhotos`.`photo_queue`.`screener_2` AS `screener_2`,
  `TOGAPhotos`.`photo_queue`.`reason` AS `reason`,
  `TOGAPhotos`.`photo_queue`.`screener_remark` AS `screener_remark`,
  `TOGAPhotos`.`photo_queue`.`result` AS `result`,
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
  `p`.`upload_time` AS `upload_time`,
  `a`.`airport_cn` AS `airport_cn`,
  `a`.`airport_en` AS `airport_en`,
  `a`.`icao_code` AS `airport_icao_code`,
  `a`.`iata_code` AS `airport_iata_code`,
  `a`.`is_delete` AS `is_delete`
FROM
  (
    (
      (
        `TOGAPhotos`.`photo_queue`
        JOIN `TOGAPhotos`.`photo` `p` ON(
          (`TOGAPhotos`.`photo_queue`.`photo_id` = `p`.`id`)
        )
      )
      JOIN `TOGAPhotos`.`airport` `a` ON((`p`.`airport_id` = `a`.`id`))
    )
    JOIN `TOGAPhotos`.`user` ON(
      (`p`.`upload_user_id` = `TOGAPhotos`.`user`.`id`)
    )
  )