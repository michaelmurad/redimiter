export function noIp(ip, res) {
  if (!ip) {
    res.status(500).send("No IP address");
    return res.end();
  }
}
