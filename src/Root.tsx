import React from 'react';
import { Composition } from 'remotion';
import { MyComp } from './compositions/MyComp';
import { LowerThirdVFD, getDuration, LowerThirdVFDProps } from './compositions/LowerThirdVFD';

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
        backgroundColor={null}
        defaultProps={{
          line1: 'Zero to ASIC Course - Chapter 1',
          line2: 'Matt Venn',
        }}
        calculateMetadata={({ props }: { props: LowerThirdVFDProps }) => ({
          durationInFrames: getDuration(props.line1 ?? '', props.line2 ?? '', 30),
        })}
      />
    </>
  );
};
