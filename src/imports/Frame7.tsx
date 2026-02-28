import clsx from "clsx";
import svgPaths from "./svg-m4lwl8pe3p";
import imgImage5 from "figma:asset/fad7f8e8922bfcc30e178d2ea157702b11aa5afb.png";
type WrapperProps = {
  additionalClassNames?: string;
};

function Wrapper({ children, additionalClassNames = "" }: React.PropsWithChildren<WrapperProps>) {
  return (
    <div className={additionalClassNames}>
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        {children}
      </svg>
    </div>
  );
}
type IconFastForwardProps = {
  additionalClassNames?: string;
};

function IconFastForward({ additionalClassNames = "" }: IconFastForwardProps) {
  return (
    <Wrapper additionalClassNames={clsx("relative size-[32px]", additionalClassNames)}>
      <g id="IconFastForward">
        <path d={svgPaths.p1bcae800} fill="var(--fill-0, white)" fillOpacity="0.5" id="Vector" />
      </g>
    </Wrapper>
  );
}

export default function Frame() {
  return (
    <div className="bg-[rgba(0,0,0,0.5)] content-stretch flex flex-col gap-[16px] items-center justify-center p-[16px] relative rounded-[24px] size-full">
      <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
        <div className="content-stretch flex flex-[1_0_0] gap-[8px] items-center min-h-px min-w-px relative">
          <div className="relative rounded-[8px] shrink-0 size-[48px]" data-name="image 5">
            <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[8px] size-full" src={imgImage5} />
          </div>
          <div className="content-stretch flex flex-[1_0_0] flex-col font-['Inter:Medium',sans-serif] font-medium gap-[4px] items-start justify-end leading-[normal] min-h-px min-w-px not-italic overflow-clip relative text-[16px] text-[transparent]">
            <p className="bg-clip-text bg-gradient-to-r from-[57.371%] from-white relative shrink-0 to-[63.745%] to-[rgba(255,255,255,0)]" style={{ WebkitTextFillColor: "transparent" }}>
              Homiesexual (with Ty Dolla $ign)
            </p>
            <p className="bg-clip-text bg-gradient-to-r from-[67.606%] from-[rgba(255,255,255,0.6)] relative shrink-0 to-[75.117%] to-[rgba(255,255,255,0)]" style={{ WebkitTextFillColor: "transparent" }}>
              Daniel Caesar, Ty Dolla $ign
            </p>
          </div>
        </div>
        <div className="content-stretch flex gap-[2px] items-center justify-center relative shrink-0 size-[24px]">
          <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
          <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
          <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
          <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
          <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
          <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
        </div>
      </div>
      <div className="content-stretch flex gap-[8px] items-center justify-center relative shrink-0 w-full">
        <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[10px] text-[rgba(255,255,255,0.4)]">2:19</p>
        <div className="content-stretch flex flex-[1_0_0] h-[6px] items-center min-h-px min-w-px overflow-clip relative rounded-[100px]">
          <div className="bg-[rgba(217,217,217,0.4)] flex-[1_0_0] h-full min-h-px min-w-px" />
          <div className="bg-[rgba(255,255,255,0.1)] flex-[1_0_0] h-full min-h-px min-w-px" />
        </div>
        <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[10px] text-[rgba(255,255,255,0.4)]">2:19</p>
      </div>
      <div className="content-stretch flex gap-[24px] items-center relative shrink-0">
        <div className="flex items-center justify-center relative shrink-0">
          <div className="-scale-y-100 flex-none rotate-180">
            <IconFastForward />
          </div>
        </div>
        <Wrapper additionalClassNames="relative shrink-0 size-[32px]">
          <g id="IconPlay">
            <path d={svgPaths.p3a57d900} fill="var(--fill-0, white)" id="Vector" />
          </g>
        </Wrapper>
        <IconFastForward additionalClassNames="shrink-0" />
      </div>
    </div>
  );
}