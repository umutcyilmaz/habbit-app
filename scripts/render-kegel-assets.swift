// Offline CoreGraphics port of muscleHam() in the supplied Kegel HTML.
// Run: swift scripts/render-kegel-assets.swift
// Transparent 3x layers; RN animates the muscle about SVG origin (120,112).
import AppKit
import CoreGraphics

let output = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("src/features/kegel/assets")
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
func color(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> CGColor {
    CGColor(red: r/255, green: g/255, blue: b/255, alpha: a)
}
func path(_ start: CGPoint, _ draw: (CGMutablePath) -> Void) -> CGPath {
    let p = CGMutablePath(); p.move(to: start); draw(p); return p
}
func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x, y: y) }
func image(_ name: String, width: Int = 240, height: Int = 180, draw: (CGContext) -> Void) throws {
    let c = CGContext(data: nil, width: width*3, height: height*3, bitsPerComponent: 8,
        bytesPerRow: width*12, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    c.scaleBy(x: 3, y: 3); c.translateBy(x: 0, y: CGFloat(height)); c.scaleBy(x: 1, y: -1)
    c.setLineCap(.round); c.setLineJoin(.round); draw(c)
    let bitmap = NSBitmapImageRep(cgImage: c.makeImage()!)
    try bitmap.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent(name + ".png"))
}
func stroke(_ c: CGContext, _ p: CGPath, _ col: CGColor, _ width: CGFloat) {
    c.addPath(p); c.setStrokeColor(col); c.setLineWidth(width); c.strokePath()
}
let band = path(pt(58,110)) { p in
    p.addQuadCurve(to: pt(182,110), control: pt(120,146)); p.addLine(to: pt(182,112))
    p.addQuadCurve(to: pt(168,136), control: pt(182,128)); p.addQuadCurve(to: pt(72,136), control: pt(120,186))
    p.addQuadCurve(to: pt(58,110), control: pt(58,128)); p.closeSubpath()
}
try image("bones") { c in
    stroke(c, path(pt(44,14)) { $0.addCurve(to: pt(58,116), control1: pt(22,40), control2: pt(26,86)) }, color(255,255,255,0.2), 7)
    stroke(c, path(pt(196,14)) { $0.addCurve(to: pt(182,116), control1: pt(218,40), control2: pt(214,86)) }, color(255,255,255,0.2), 7)
    stroke(c, path(pt(58,116)) { $0.addCurve(to: pt(94,130), control1: pt(68,126), control2: pt(80,130)) }, color(255,255,255,0.16), 5)
    stroke(c, path(pt(182,116)) { $0.addCurve(to: pt(146,130), control1: pt(172,126), control2: pt(160,130)) }, color(255,255,255,0.16), 5)
}
try image("bladder") { c in
    c.setFillColor(color(255,255,255,0.05)); c.setStrokeColor(color(255,255,255,0.22)); c.setLineWidth(1.5)
    c.addEllipse(in: CGRect(x: 86,y:53,width:68,height:54)); c.drawPath(using: .fillStroke)
}
try image("muscle") { c in
    c.saveGState(); c.setShadow(offset: CGSize(width: 0,height: 6), blur: 14, color: color(58,75,255,0.45))
    c.addPath(band); c.setFillColor(color(90,104,255)); c.fillPath(); c.restoreGState()
    c.saveGState(); c.addPath(band); c.clip()
    let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [color(31,42,158),color(90,104,255),color(31,42,158)] as CFArray, locations: [0,0.5,1])!
    c.drawLinearGradient(g, start: pt(58,130), end: pt(182,130), options: [])
    let v = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [color(255,255,255,0.35),color(255,255,255,0),color(0,0,0,0.35)] as CFArray, locations: [0,0.5,1])!
    c.drawLinearGradient(v, start: pt(120,110), end: pt(120,161), options: [])
    for f: CGFloat in [0.14,0.28,0.42,0.56,0.7,0.84] {
        stroke(c, path(pt(60+f*6,110+f*14)) { $0.addQuadCurve(to: pt(180-f*6,110+f*14), control: pt(120,146+f*32)) }, color(214,220,255,0.55),1.1)
    }
    for dx: CGFloat in [-50,-40,-30,-20,-10,0,10,20,30,40,50] {
        let t = abs(dx)/62, yt = 146-36*t*t-6, yb = yt+28-16*t*t
        stroke(c, path(pt(120+dx,yt+1.5)) { $0.addLine(to:pt(120+dx+dx*0.08,yb-1.5)) },color(10,14,60,0.35),1)
    }
    c.restoreGState()
    stroke(c, path(pt(58,110)) { $0.addQuadCurve(to:pt(182,110),control:pt(120,146)) },color(201,208,255,0.9),2)
}
try image("glow", width: 400, height: 400) { c in
    let gradient = CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:[color(111,124,255,0.42),color(58,75,255,0.16),color(58,75,255,0)] as CFArray,locations:[0,0.35,1])!
    c.drawRadialGradient(gradient,startCenter:pt(200,200),startRadius:0,endCenter:pt(200,200),endRadius:200,options:[])
}
try image("connectors", width:290,height:28) { c in
    stroke(c,path(pt(145,0)) { $0.addLine(to:pt(145,28)) },color(255,255,255,0.22),1.5)
    stroke(c,path(pt(36,28)) { p in p.addLine(to:pt(36,18)); p.addQuadCurve(to:pt(42,12),control:pt(36,12)); p.addLine(to:pt(248,12)); p.addQuadCurve(to:pt(254,18),control:pt(254,12)); p.addLine(to:pt(254,28)) },color(255,255,255,0.22),1.5)
}
print("Rendered five transparent Kegel layers from the reference geometry.")

// Small native Image icons, ported from the supplied SVGs; tint stays in RN.
func icon(_ name:String,_ draw:(CGContext)->Void) throws {
    try image("icon-"+name,width:24,height:24) { c in c.setFillColor(color(255,255,255));draw(c) }
}
func fill(_ c:CGContext,_ p:CGPath) { c.addPath(p);c.fillPath() }
func polygon(_ coords:[CGPoint])->CGPath { path(coords[0]) { p in for point in coords.dropFirst() {p.addLine(to:point)};p.closeSubpath() } }
try icon("drop") { c in
    fill(c,path(pt(12,2)) { p in
        p.addCurve(to:pt(5,14.6),control1:pt(12,2),control2:pt(5,9.7));p.addCurve(to:pt(12,22),control1:pt(5,18.7),control2:pt(8,22))
        p.addCurve(to:pt(19,14.6),control1:pt(16,22),control2:pt(19,18.7));p.addCurve(to:pt(12,2),control1:pt(19,9.7),control2:pt(12,2));p.closeSubpath()
    })
}
try icon("up") {fill($0,polygon([pt(12,3),pt(20,12),pt(15,12),pt(15,21),pt(9,21),pt(9,12),pt(4,12)]))}
try icon("body") { c in c.fillEllipse(in:CGRect(x:9.4,y:1.4,width:5.2,height:5.2));fill(c,polygon([pt(8,8),pt(16,8),pt(15,15),pt(13.6,15),pt(13,22),pt(11,22),pt(10.4,15),pt(9,15)])) }
try icon("bed") { c in
    fill(c,polygon([pt(2,5),pt(4,5),pt(4,13),pt(11,13),pt(11,8),pt(19,8),pt(22,11),pt(22,19),pt(20,19),pt(20,16),pt(4,16),pt(4,19),pt(2,19)]))
    c.fillEllipse(in:CGRect(x:5,y:8,width:5,height:5))
}
try icon("lung") { c in
    fill(c,polygon([pt(11,3),pt(13,3),pt(13,11),pt(15.2,9.4),pt(15,12),pt(13,13.6),pt(12,12.9),pt(11,13.6),pt(9,12),pt(8.8,9.4),pt(11,11)]))
    for right in [false,true] {
        c.saveGState();if right {c.translateBy(x:24,y:0);c.scaleBy(x:-1,y:1)}
        fill(c,path(pt(8.8,9.4)) { p in p.addCurve(to:pt(4.5,6.2),control1:pt(7.8,6),control2:pt(6,5));p.addCurve(to:pt(2.6,17.5),control1:pt(2.6,7.7),control2:pt(2,13));p.addCurve(to:pt(7,20.1),control1:pt(2.9,19.7),control2:pt(5,20.9));p.addLine(to:pt(9.4,19.1));p.addQuadCurve(to:pt(11,16.7),control:pt(11,18.5));p.addLine(to:pt(11,11));p.closeSubpath() })
        c.restoreGState()
    }
}
try icon("wave") { c in
    stroke(c,path(pt(2,12)) {p in p.addCurve(to:pt(9.5,12),control1:pt(4.5,7),control2:pt(7,7));p.addCurve(to:pt(17,12),control1:pt(12,17),control2:pt(14.5,17));p.addCurve(to:pt(22,11),control1:pt(19.5,7),control2:pt(20.5,8)) },color(255,255,255),2.4)
}
try icon("wind") { c in
    stroke(c,path(pt(3,9)) { p in p.addLine(to:pt(14,9));p.addCurve(to:pt(11,6),control1:pt(19,9),control2:pt(14,1)) },color(255,255,255),2.2)
    stroke(c,path(pt(3,13)) { p in p.addLine(to:pt(18,13));p.addCurve(to:pt(15,16),control1:pt(23,13),control2:pt(18,21)) },color(255,255,255),2.2)
    stroke(c,path(pt(3,17)) {$0.addLine(to:pt(9,17))},color(255,255,255),2.2)
}
for name in ["clock","timer","info"] {
    try icon(name) {c in
        if name == "timer" {c.fill(CGRect(x:9,y:1,width:6,height:2))}
        c.fillEllipse(in:CGRect(x:2,y:name == "timer" ? 4 : 2,width:20,height:20))
        c.setBlendMode(.clear)
        if name == "info" { c.fill(CGRect(x:10.8,y:10,width:2.4,height:8));c.fillEllipse(in:CGRect(x:10.5,y:5.8,width:3,height:3)) }
        else {fill(c,polygon([pt(11,7),pt(13,7),pt(13,12.4),pt(17,14.8),pt(16,16.4),pt(11,13)]))}
    }
}
try icon("warn") {c in fill(c,polygon([pt(12,2.5),pt(23,21),pt(1,21)]));c.setBlendMode(.clear);c.fill(CGRect(x:10.8,y:9,width:2.4,height:6));c.fillEllipse(in:CGRect(x:10.6,y:16.6,width:2.8,height:2.8))}
try icon("cal") {c in
    c.fill(CGRect(x:3,y:4,width:18,height:18));c.fill(CGRect(x:7,y:2,width:2,height:4));c.fill(CGRect(x:15,y:2,width:2,height:4))
    c.setBlendMode(.clear);c.fill(CGRect(x:5,y:10,width:14,height:10))
}
try icon("rep") {c in
    let p=CGMutablePath();p.addArc(center:pt(12,12),radius:6.75,startAngle:CGFloat.pi/2,endAngle:CGFloat.pi*1.9,clockwise:false)
    stroke(c,p,color(255,255,255),2.5);fill(c,polygon([pt(22,9.2),pt(19,15),pt(14.4,11.3)]))
}
try icon("flame") {c in
    fill(c,path(pt(12,2)) {p in p.addCurve(to:pt(19.5,14),control1:pt(13.3,6.3),control2:pt(19.5,8.8));p.addCurve(to:pt(12,22),control1:pt(19.5,18.5),control2:pt(16.3,22));p.addCurve(to:pt(4.5,14),control1:pt(7.7,22),control2:pt(4.5,18.5));p.addCurve(to:pt(7.3,7),control1:pt(4.5,10.5),control2:pt(6.5,8.9));p.addQuadCurve(to:pt(10.5,11),control:pt(8.3,10.3));p.addQuadCurve(to:pt(12,2),control:pt(11.3,6));p.closeSubpath()})
}
print("Rendered reference icon silhouettes.")
