import React from 'react';
import { CalculateMetadataFunction, Composition } from 'remotion';
import { LowerThirdVFD, getDuration, LowerThirdVFDProps, lowerThirdVFDSchema } from './compositions/LowerThirdVFD';
import { LowerThirdCallToAction, getDuration as getCtaDuration, LowerThirdCallToActionProps, lowerThirdCallToActionSchema } from './compositions/LowerThirdCallToAction';
import { TTLowerThird, TTLowerThirdProps, ttLowerThirdSchema, calculateMetadata as calcTTLowerThird } from './compositions/TTLowerThird';
import { TTCallToAction, TTCallToActionProps, ttCallToActionSchema, calculateMetadata as calcTTCallToAction } from './compositions/TTCallToAction';
import { Z2ATitleBar, Z2ATitleBarProps, z2ATitleBarSchema, calculateMetadata as calcZ2ATitleBar } from './compositions/Z2ATitleBar';
import { Z2ATitleBarV2, Z2ATitleBarV2Props, z2ATitleBarV2Schema, calculateMetadataV2 as calcZ2ATitleBarV2 } from './compositions/Z2ATitleBarV2';
import { Z2ALogoAnim, z2ALogoAnimSchema } from './compositions/Z2ALogoAnim';

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
        defaultProps={{"name":"Matt Venn","title":"Tiny Tapeout","holdEnd":67}}
      />
      <Composition
        id="TTCallToAction"
        component={TTCallToAction}
        calculateMetadata={calcTTCallToAction as CalculateMetadataFunction<TTCallToActionProps>}
        schema={ttCallToActionSchema}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{"header":"Try Tin","line1":"tinytapeout.com","line2":"Link in description","holdEnd":62}}
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
        defaultProps={{"line1":"Zero to ASIC course","line2":"An introduction to analog microelectronics","holdFrames":79,"exitStyle":"fade" as const,"discStartScale":2,"discRingThickness":18,"discWhiteRing":15,"highlight":true,"highlightStart":60,"highlightLength":8,"highlightIntensity":20}}
      />
      <Composition
        id="Z2ALogoAnim"
        component={Z2ALogoAnim}
        schema={z2ALogoAnimSchema}
        durationInFrames={96}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{"size":100,"cx":850,"cy":400,"blend":"multiply" as const}}
      />
    </>
  );
};
