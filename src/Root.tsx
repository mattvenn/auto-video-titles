import React from 'react';
import { CalculateMetadataFunction, Composition } from 'remotion';
import { MyComp } from './compositions/MyComp';
import { LowerThirdVFD, getDuration, LowerThirdVFDProps, lowerThirdVFDSchema } from './compositions/LowerThirdVFD';
import { LowerThirdCallToAction, getDuration as getCtaDuration, LowerThirdCallToActionProps, lowerThirdCallToActionSchema } from './compositions/LowerThirdCallToAction';
import { TTLowerThird, TTLowerThirdProps, ttLowerThirdSchema, calculateMetadata as calcTTLowerThird } from './compositions/TTLowerThird';
import { TTCallToAction, TTCallToActionProps, ttCallToActionSchema, calculateMetadata as calcTTCallToAction } from './compositions/TTCallToAction';
import { Z2ATitleBar, Z2ATitleBarProps, z2ATitleBarSchema, calculateMetadata as calcZ2ATitleBar } from './compositions/Z2ATitleBar';
import { Z2ALogo } from './compositions/Z2ALogo';
import { Z2ALogoAnim } from './compositions/Z2ALogoAnim';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComp"
        component={MyComp}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
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
        id="Z2ALogo"
        component={Z2ALogo}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Z2ALogoAnim"
        component={Z2ALogoAnim}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
