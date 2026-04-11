import React from 'react';
import { CalculateMetadataFunction, Composition } from 'remotion';
import { MyComp } from './compositions/MyComp';
import { LowerThirdVFD, getDuration, LowerThirdVFDProps } from './compositions/LowerThirdVFD';
import { LowerThirdCallToAction, getDuration as getCtaDuration, LowerThirdCallToActionProps } from './compositions/LowerThirdCallToAction';
import { TTLowerThird, TTLowerThirdProps, calculateMetadata as calcTTLowerThird } from './compositions/TTLowerThird';
import { TTCallToAction, TTCallToActionProps, calculateMetadata as calcTTCallToAction } from './compositions/TTCallToAction';

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
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          line1: 'Zero to ASIC Course - Chapter 1',
          line2: 'Matt Venn',
        }}
        calculateMetadata={({ props }: { props: LowerThirdVFDProps }) => ({
          durationInFrames: getDuration(props.line1 ?? '', props.line2 ?? '', 30),
        })}
      />
      <Composition
        id="LowerThirdCallToAction"
        component={LowerThirdCallToAction}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          header: 'Zero to ASIC Course',
          line1:  'github.com/zerotoasic',
          line2:  'Link in description',
        }}
        calculateMetadata={({ props }: { props: LowerThirdCallToActionProps }) => ({
          durationInFrames: getCtaDuration(props.header ?? '', props.line1 ?? '', props.line2 ?? '', 30),
        })}
      />
      <Composition
        id="TTLowerThird"
        component={TTLowerThird}
        calculateMetadata={calcTTLowerThird as CalculateMetadataFunction<TTLowerThirdProps>}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          name:  'Matt Venn',
          title: 'Tiny Tapeout',
        }}
      />
      <Composition
        id="TTCallToAction"
        component={TTCallToAction}
        calculateMetadata={calcTTCallToAction as CalculateMetadataFunction<TTCallToActionProps>}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          header: 'Try Tiny Tapeout',
          line1:  'tinytapeout.com',
          line2:  'Link in description',
        }}
      />
    </>
  );
};
