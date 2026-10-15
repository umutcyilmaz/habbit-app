import { useState } from "react";
import { StyleSheet, View, useWindowDimensions, type TextStyle, type ViewStyle } from "react-native";
import { AppText, type AppTextProps } from "../../shared/components/v4/AppText";
import { theme } from "../../shared/design-system/v4/theme";
import { practiceTypeStyle, practiceWordFit, type PracticeTextRole } from "./practiceTypography";

function textContent(value: AppTextProps["children"]): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return Array.isArray(value) ? value.map(textContent).join("") : "";
}
// Keep the measuring constraint independent of the glyphs being fitted. A Text
// in an alignItems:center/start row has an intrinsic width: using that as the
// constraint causes successive layout events to shrink it again and again.
const layoutKeys = new Set(["alignSelf","display","position","top","bottom","left","right","width","minWidth","maxWidth","height","minHeight","maxHeight","flex","flexGrow","flexShrink","flexBasis","margin","marginTop","marginBottom","marginLeft","marginRight","marginHorizontal","marginVertical","marginStart","marginEnd","padding","paddingTop","paddingBottom","paddingLeft","paddingRight","paddingHorizontal","paddingVertical","paddingStart","paddingEnd","backgroundColor","borderRadius","borderWidth","borderColor"]);
export function splitPracticeTextStyle(style: TextStyle) {
  const layout: Record<string, unknown> = {}, text: Record<string, unknown> = {};
  for (const [key,value] of Object.entries(style)) (layoutKeys.has(key) ? layout : text)[key] = value;
  return {layout:layout as ViewStyle,text:text as TextStyle};
}

/** Practice-only responsive text. Essential prose retains native scaling unless
 * a measured whole word exceeds its allocated line. No height fit/truncation.
 */
export function PracticeText({textRole = "content", variant = "body", style, children, onLayout, ...props}: AppTextProps & {textRole?: PracticeTextRole}) {
  const {fontScale} = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [measurement, setMeasurement] = useState({signature:"", widest:0});
  const [paragraph, setParagraph] = useState({signature:"", height:0});
  const preferred = practiceTypeStyle(StyleSheet.flatten([theme.typography[variant], style]) as TextStyle, textRole, fontScale);
  const {layout,text} = splitPracticeTextStyle(preferred);
  const words = [...new Set(textContent(children).split(/[ \t\r\n]+/u).filter(Boolean))];
  const font = {fontFamily:text.fontFamily,fontSize:text.fontSize,fontWeight:text.fontWeight,fontStyle:text.fontStyle,lineHeight:text.lineHeight,letterSpacing:text.letterSpacing,fontVariant:text.fontVariant,textTransform:text.textTransform};
  const signature = JSON.stringify([fontScale, font, words]);
  const fit = textRole === "timer" ? 1 : practiceWordFit(width, measurement.signature === signature ? measurement.widest : 0);
  const fitted = {fontSize:text.fontSize!*fit,lineHeight:text.lineHeight!*fit,letterSpacing:text.letterSpacing!*fit};
  const paragraphSignature = JSON.stringify([signature,width,fit]);
  const horizontalPadding = Number(layout.paddingLeft ?? layout.paddingStart ?? layout.paddingHorizontal ?? layout.padding ?? 0) + Number(layout.paddingRight ?? layout.paddingEnd ?? layout.paddingHorizontal ?? layout.padding ?? 0);
  return <View style={[s.container,layout]} onLayout={event=>{const next=event.nativeEvent.layout.width-horizontalPadding;setWidth(old=>Math.abs(old-next)>.5?next:old);onLayout?.(event);}}>
    <AppText key={fontScale} {...props} variant={variant} style={[text,fitted,{minHeight:paragraph.signature===paragraphSignature?paragraph.height:undefined}]}>{children}</AppText>
    {textRole !== "timer" && words.length > 0 && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.measure}>
      <AppText key={signature} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" variant={variant} allowFontScaling={props.allowFontScaling} style={[font,{width:16384}]} onTextLayout={event=>{const widest=Math.max(0,...event.nativeEvent.lines.map(line=>line.width));setMeasurement(old=>old.signature===signature&&Math.abs(old.widest-widest)<.5?old:{signature,widest});}}>{words.join("\n")}</AppText>
      {/* iOS can under-measure a paragraph after a scaled font adjustment and
          clip the remaining words into its final finite-height line. Measure
          the fitted paragraph with vertical room, then reserve only its native
          line extent plus a 2pt rounding allowance. Never fit prose to height. */}
      {fit < 1 && width > 0 && <AppText key={paragraphSignature} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" variant={variant} allowFontScaling={props.allowFontScaling} style={[font,fitted,{width,height:16384}]} onTextLayout={event=>{const height=Math.ceil(Math.max(0,...event.nativeEvent.lines.map(line=>line.y+line.height)))+2;setParagraph(old=>old.signature===paragraphSignature&&old.height===height?old:{signature:paragraphSignature,height});}}>{children}</AppText>}
    </View>}
  </View>;
}
const s=StyleSheet.create({container:{alignSelf:"stretch",minWidth:0,maxWidth:"100%"},measure:{position:"absolute",width:0,height:0,overflow:"hidden",opacity:0}});
