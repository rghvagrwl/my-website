import clsx from "clsx";
import svgPaths from "./svg-umafma3ph";
import imgImage5 from "figma:asset/fad7f8e8922bfcc30e178d2ea157702b11aa5afb.png";
type WrapperProps = {
  additionalClassNames?: string;
};

function Wrapper({ children, additionalClassNames = "" }: React.PropsWithChildren<WrapperProps>) {
  return (
    <div className={additionalClassNames}>
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        {children}
      </svg>
    </div>
  );
}
type IconSkipProps = {
  additionalClassNames?: string;
};

function IconSkip({ additionalClassNames = "" }: IconSkipProps) {
  return (
    <Wrapper additionalClassNames={clsx("relative size-[24px]", additionalClassNames)}>
      <g id="IconSkip">
        <path d={svgPaths.p2ce6ce00} fill="var(--fill-0, white)" fillOpacity="0.5" id="Vector" />
        <path d={svgPaths.p24e2c00} fill="var(--fill-0, white)" fillOpacity="0.5" id="Vector_2" />
      </g>
    </Wrapper>
  );
}

export default function MacBookPro() {
  return (
    <div className="bg-white content-stretch flex flex-col items-center justify-center px-[144px] py-[160px] relative size-full" data-name="MacBook Pro 14' - 2">
      <div className="bg-[rgba(0,0,0,0.5)] content-stretch flex flex-col gap-[16px] items-center justify-center p-[16px] relative rounded-[24px] shrink-0 w-[296px]">
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
          <div className="content-stretch flex flex-col items-center justify-center p-[8px] relative shrink-0">
            <div className="content-stretch flex gap-[2px] items-center relative shrink-0 size-[24px]">
              <div className="bg-[rgba(255,255,255,0.4)] h-[16px] rounded-[100px] shrink-0 w-[2px]" />
              <div className="bg-[rgba(255,255,255,0.4)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
              <div className="bg-[rgba(255,255,255,0.4)] h-[14px] rounded-[100px] shrink-0 w-[2px]" />
              <div className="bg-[rgba(255,255,255,0.4)] h-[8px] rounded-[100px] shrink-0 w-[2px]" />
              <div className="bg-[rgba(255,255,255,0.4)] h-[12px] rounded-[100px] shrink-0 w-[2px]" />
              <div className="bg-[rgba(255,255,255,0.4)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
            </div>
          </div>
        </div>
        <div className="content-stretch flex gap-[24px] items-center relative shrink-0">
          <div className="flex items-center justify-center relative shrink-0">
            <div className="-scale-y-100 flex-none rotate-180">
              <IconSkip />
            </div>
          </div>
          <div className="content-stretch flex items-center relative shrink-0">
            <Wrapper additionalClassNames="relative shrink-0 size-[24px]">
              <g id="IconPause">
                <path d={svgPaths.pb8e7d00} fill="var(--fill-0, white)" fillOpacity="0.8" id="Vector" />
                <path d={svgPaths.p2c40c880} fill="var(--fill-0, white)" fillOpacity="0.8" id="Vector_2" />
              </g>
            </Wrapper>
          </div>
          <IconSkip additionalClassNames="shrink-0" />
        </div>
      </div>
    </div>
  );
}