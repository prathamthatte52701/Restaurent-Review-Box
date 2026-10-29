export const sendOk = (res, data = null, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, data, message });

export const sendList = (res, { data, pagination }, message = 'OK') =>
  res.status(200).json({ success: true, data, pagination, message });
