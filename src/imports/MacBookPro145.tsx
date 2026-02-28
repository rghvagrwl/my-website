import clsx from "clsx";
import svgPaths from "./svg-gsvaqqrzvd";
import imgImage6 from "figma:asset/fad7f8e8922bfcc30e178d2ea157702b11aa5afb.png";
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
type HelperProps = {
  additionalClassNames?: string;
};

function Helper({ additionalClassNames = "" }: HelperProps) {
  return (
    <div className={clsx("content-stretch flex gap-[2px] items-center justify-center relative shrink-0 size-[24px]", additionalClassNames)}>
      <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
      <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
      <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
      <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
      <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
      <div className="bg-[rgba(255,255,255,0.25)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
    </div>
  );
}
type Group1ImageImageProps = {
  additionalClassNames?: string;
};

function Group1ImageImage({ additionalClassNames = "" }: Group1ImageImageProps) {
  return (
    <div className={clsx("col-1 ml-0 relative rounded-[24px] row-1 size-[320px]", additionalClassNames)}>
      <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[24px] size-full" src={imgImage6} />
    </div>
  );
}

export default function MacBookPro() {
  return (
    <div className="bg-white content-stretch flex flex-col gap-[10px] items-center justify-center px-[144px] py-[160px] relative size-full" data-name="MacBook Pro 14' - 5">
      <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
        <Group1ImageImage additionalClassNames="blur-[64px] mt-[0.5px]" />
        <Group1ImageImage additionalClassNames="mt-0" />
      </div>
      <div className="bg-[rgba(0,0,0,0.5)] content-stretch flex flex-col gap-[16px] items-center justify-center p-[16px] relative rounded-[24px] shrink-0 w-[320px]">
        <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
          <Helper additionalClassNames="opacity-0" />
          <div className="content-stretch flex flex-[1_0_0] flex-col font-['Inter:Medium',sans-serif] font-medium gap-[4px] items-center justify-center leading-[normal] min-h-px min-w-px not-italic overflow-clip relative text-[14px]">
            <p className="relative shrink-0 text-white">Homiesexual (with Ty Dolla $ign)</p>
            <p className="relative shrink-0 text-[rgba(255,255,255,0.6)]">Daniel Caesar, Ty Dolla $ign</p>
          </div>
          <Helper />
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
    </div>
  );
}