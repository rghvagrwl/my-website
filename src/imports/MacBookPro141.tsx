import imgImage5 from "figma:asset/fad7f8e8922bfcc30e178d2ea157702b11aa5afb.png";

export default function MacBookPro() {
  return (
    <div className="bg-white content-stretch flex flex-col items-center justify-center px-[144px] py-[160px] relative size-full" data-name="MacBook Pro 14' - 1">
      <div className="bg-[rgba(0,0,0,0.5)] content-stretch flex gap-[16px] items-center justify-center px-[16px] py-[8px] relative rounded-[12px] shrink-0">
        <div className="relative rounded-[4px] shrink-0 size-[24px]" data-name="image 5">
          <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[4px] size-full" src={imgImage5} />
        </div>
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[normal] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.8)]">Playing</p>
        <div className="content-stretch flex gap-[2px] items-center justify-center relative shrink-0 size-[24px]">
          <div className="bg-[rgba(255,255,255,0.4)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
          <div className="bg-[rgba(255,255,255,0.4)] h-[8px] rounded-[100px] shrink-0 w-[2px]" />
          <div className="bg-[rgba(255,255,255,0.4)] h-[14px] rounded-[100px] shrink-0 w-[2px]" />
          <div className="bg-[rgba(255,255,255,0.4)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
          <div className="bg-[rgba(255,255,255,0.4)] h-[10px] rounded-[100px] shrink-0 w-[2px]" />
          <div className="bg-[rgba(255,255,255,0.4)] h-[4px] rounded-[100px] shrink-0 w-[2px]" />
        </div>
      </div>
    </div>
  );
}