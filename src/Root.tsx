import React from 'react';
import { Composition } from 'remotion';
import { MyComp } from './compositions/MyComp';
import { LowerThirdVFD, getDuration, LowerThirdVFDProps } from './compositions/LowerThirdVFD';
import { LowerThirdCallToAction, getDuration as getCtaDuration, LowerThirdCallToActionProps } from './compositions/LowerThirdCallToAction';

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
    </>
  );
};
