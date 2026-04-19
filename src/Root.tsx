import React from 'react';
import { CalculateMetadataFunction, Composition } from 'remotion';
import { LowerThirdVFD, getDuration, LowerThirdVFDProps, lowerThirdVFDSchema } from './compositions/LowerThirdVFD';
import { LowerThirdCallToAction, getDuration as getCtaDuration, LowerThirdCallToActionProps, lowerThirdCallToActionSchema } from './compositions/LowerThirdCallToAction';
import { TTLowerThird, TTLowerThirdProps, ttLowerThirdSchema, calculateMetadata as calcTTLowerThird } from './compositions/TTLowerThird';
import { TTCallToAction, TTCallToActionProps, ttCallToActionSchema, calculateMetadata as calcTTCallToAction } from './compositions/TTCallToAction';
import { TTTopicCard, TTTopicCardProps, ttTopicCardSchema, calculateMetadata as calcTTTopicCard } from './compositions/TTTopicCard';
import { Z2ATitleBar, Z2ATitleBarProps, z2ATitleBarSchema, calculateMetadata as calcZ2ATitleBar } from './compositions/Z2ATitleBar';
import { Z2ATitleBarV2, Z2ATitleBarV2Props, z2ATitleBarV2Schema, calculateMetadataV2 as calcZ2ATitleBarV2 } from './compositions/Z2ATitleBarV2';
import { Z2ALogoAnim, z2ALogoAnimSchema } from './compositions/Z2ALogoAnim';
import { Z2AIntro, Z2AIntroProps, z2AIntroSchema, calculateMetadata as calcZ2AIntro } from './compositions/Z2AIntro';
import { Z2AIntroLogoExpand, Z2AIntroLogoExpandProps, z2AIntroLogoExpandSchema, calculateMetadata as calcZ2AIntroLogoExpand } from './compositions/Z2AIntroLogoExpand';
import { Z2ACallToAction, Z2ACallToActionProps, z2ACallToActionSchema, calculateMetadata as calcZ2ACallToAction } from './compositions/Z2ACallToAction';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LowerThirdVFD"
        component={LowerThirdVFD}
        schema={lowerThirdVFDSchema}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          line1: 'Zero to ASIC Course - Chapter 1',
          line2: 'Matt Venn',
        }}
        calculateMetadata={({ props }: { props: LowerThirdVFDProps }) => ({
          durationInFrames: getDuration(props.line1, props.line2, 30),
        })}
      />
      <Composition
        id="LowerThirdCallToAction"
        component={LowerThirdCallToAction}
        schema={lowerThirdCallToActionSchema}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          header: 'Zero to ASIC Course',
          line1:  'github.com/zerotoasic',
          line2:  'Link in description',
        }}
        calculateMetadata={({ props }: { props: LowerThirdCallToActionProps }) => ({
          durationInFrames: getCtaDuration(props.header, props.line1, props.line2, 30),
        })}
      />
      <Composition
        id="TTLowerThird"
        component={TTLowerThird}
        calculateMetadata={calcTTLowerThird as CalculateMetadataFunction<TTLowerThirdProps>}
        schema={ttLowerThirdSchema}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{"title":"Commander app","extra_text":"","holdEnd":77}}
      />
      <Composition
        id="TTCallToAction"
        component={TTCallToAction}
        calculateMetadata={calcTTCallToAction as CalculateMetadataFunction<TTCallToActionProps>}
        schema={ttCallToActionSchema}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{"header":"Try Tin","line1":"tinytapeout.com","line2":"Link in description","holdEnd":100}}
      />
      <Composition
        id="TTTopicCard"
        component={TTTopicCard}
        calculateMetadata={calcTTTopicCard as CalculateMetadataFunction<TTTopicCardProps>}
        schema={ttTopicCardSchema}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{"text":"Talking to the Outside World","holdEnd":85,"vignetteStrength":59,"backgroundVideo":"microchip-background-h264.mp4" as const,"backgroundZoom":133,"videoStartFrom":37,"videoSpeed":-100,"stripOpacity":86,"textColor":"#FF6B9D" as const}}
      />
      <Composition
        id="Z2ATitleBar"
        component={Z2ATitleBar}
        calculateMetadata={calcZ2ATitleBar as CalculateMetadataFunction<Z2ATitleBarProps>}
        schema={z2ATitleBarSchema}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{"line1":"Zero to ASIC course","line2":"An introduction to analog microelectronics","holdFrames":10,"exitStyle":"fade" as const,"discStartScale":2,"discRingThickness":18,"discWhiteRing":15}}
      />
      <Composition
        id="Z2ATitleBarV2"
        component={Z2ATitleBarV2}
        calculateMetadata={calcZ2ATitleBarV2 as CalculateMetadataFunction<Z2ATitleBarV2Props>}
        schema={z2ATitleBarV2Schema}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{"line1":"SAR ADC","line2":"Carsten Wulff on TT08","holdFrames":79,"exitStyle":"fade" as const,"discStartScale":2,"discRingThickness":18,"discWhiteRing":15,"highlight":true,"highlightStart":60,"highlightLength":8,"highlightIntensity":20,"showIntroBackground":true,"introBackgroundVideo":"sine.mp4" as const,"introBackgroundZoom":120,"introVideoStartFrom":0,"introVideoSpeed":0}}
      />
      <Composition
        id="Z2ACallToAction"
        component={Z2ACallToAction}
        calculateMetadata={calcZ2ACallToAction as CalculateMetadataFunction<Z2ACallToActionProps>}
        schema={z2ACallToActionSchema}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{"header":"Zero to ASIC Course","line1":"zerotoasiccourse.com","line2":"Link in description","holdFrames":120,"exitStyle":"drop" as const,"discStartScale":2,"discRingThickness":18,"discWhiteRing":15,"highlight":true,"highlightStart":60,"highlightLength":8,"highlightIntensity":20,"showBackground":false,"backgroundVideo":"microchip-background-h264.mp4" as const,"backgroundZoom":120,"videoStartFrom":0,"videoSpeed":0}}
      />
      <Composition
        id="Z2ALogoAnim"
        component={Z2ALogoAnim}
        schema={z2ALogoAnimSchema}
        durationInFrames={88}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{"size":400,"cx":850,"cy":400,"blend":"cutout" as const}}
      />
      <Composition
        id="Z2AIntro"
        component={Z2AIntro}
        calculateMetadata={calcZ2AIntro as CalculateMetadataFunction<Z2AIntroProps>}
        schema={z2AIntroSchema}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{"holdFrames":30,"bgHoldFrames":0,"videoStartFrom":78}}
      />
      <Composition
        id="Z2AIntroLogoExpand"
        component={Z2AIntroLogoExpand}
        calculateMetadata={calcZ2AIntroLogoExpand as CalculateMetadataFunction<Z2AIntroLogoExpandProps>}
        schema={z2AIntroLogoExpandSchema}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{"holdFrames":20,"logoFadeDuration":8,"bgFadeDuration":17,"bgFadeDelay":-2,"videoStartFrom":78}}
      />
    </>
  );
};
