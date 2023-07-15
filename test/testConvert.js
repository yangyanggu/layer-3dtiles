
//const result = XYZ2LLA(6378136.999105044, -18.033653101931456, -104.96120694052074)


function convertToWGS84(centerX, centerY, centerZ) {
    const a = 6378137; // 长半轴
    const b = 6356752.3142; // 短半轴
    // 定义椭球体参数
    const f = (a - b) / a; // 扁率
    const e = Math.sqrt(2 * f - f * f); // 第一偏心率
    const e2 = e * e; // 第二偏心率

    // 计算球心坐标转换为WGS84坐标的公式
    const p = Math.sqrt(centerX * centerX + centerY * centerY);
    const theta = Math.atan2(centerZ * a, p * b);
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const latitude = Math.atan2(centerZ + e2 * b * sinTheta * sinTheta * sinTheta, p - e2 * a * cosTheta * cosTheta * cosTheta);
    const longitude = Math.atan2(centerY, centerX);
    const h = p / Math.cos(latitude) - a / Math.sqrt(1 - e2 * Math.sin(latitude) * Math.sin(latitude));

    // 将弧度转换为度
    const latitudeDeg = latitude * 180 / Math.PI;
    const longitudeDeg = longitude * 180 / Math.PI;

    // 返回WGS84坐标
    return {
        latitude: latitudeDeg,
        longitude: longitudeDeg,
        height: h
    };
}

// 示例使用
const centerX = -2307081.927348412; // 球心X坐标
const centerY = 5418677.784665749; // 球心Y坐标
const centerZ = 2440717.2996277967; // 球心Z坐标


const wgs84 = convertToWGS84(centerX, centerY, centerZ);
console.log(wgs84);
