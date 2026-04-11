import React from 'react';
import { Composition } from 'remotion';
import { MyComp } from './compositions/MyComp';
import { LowerThirdVFD, getDuration, LowerThirdVFDProps } from './compositions/LowerThirdVFD';
import { LowerThirdCallToAction, getDuration as getCtaDuration, LowerThirdCallToActionProps } from './compositions/LowerThirdCallToAction';
import { TTLowerThird, TT_DURATION } from './compositions/TTLowerThird';
import { TTCallToAction, TT_CTA_DURATION } from './compositions/TTCallToAction';

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
        durationInFrames={TT_DURATION}
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
        durationInFrames={TT_CTA_DURATION}
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
