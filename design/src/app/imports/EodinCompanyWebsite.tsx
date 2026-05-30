import svgPaths from "./svg-58dytggail";
import imgImageWithFallback from "figma:asset/97658fca33fb8976d18773f7d5ef527f8d3a91a5.png";
import imgImageWithFallback1 from "figma:asset/1b7e309cd3f960ae885b5bc9d5026f6afad2ea0e.png";
import imgImageWithFallback2 from "figma:asset/83022193bed82f2d3f818059b99fd902df434875.png";
import { imgVector, imgGroup } from "./svg-wx2mq";

function Container() {
  return <div className="absolute bg-[#fc8d42] blur-3xl filter left-[-80.17px] opacity-20 rounded-[1.67772e+07px] size-[602.045px] top-[195.22px]" data-name="Container" />;
}

function Container1() {
  return <div className="absolute bg-[#faa668] blur-3xl filter left-[526.41px] opacity-20 rounded-[1.67772e+07px] size-[500.54px] top-[90.41px]" data-name="Container" />;
}

function Container2() {
  return <div className="bg-white blur-3xl filter opacity-10 rounded-[1.67772e+07px] size-[683.437px]" data-name="Container" />;
}

function Container3() {
  return (
    <div className="absolute h-[787px] left-0 top-0 w-[947px]" data-name="Container">
      <Container />
      <Container1 />
      <div className="absolute flex items-center justify-center left-[-829.37px] size-[961.147px] top-[-377.87px]" style={{ "--transform-inner-width": "683.421875", "--transform-inner-height": "683.421875" } as React.CSSProperties}>
        <div className="flex-none rotate-[128.952deg]">
          <Container2 />
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <div className="bg-white h-[6px] relative rounded-[1.67772e+07px] shrink-0 w-[4px]" data-name="Hero">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[6px] w-[4px]" />
    </div>
  );
}

function Container4() {
  return (
    <div className="absolute box-border content-stretch flex h-[40px] items-start justify-center left-[461.5px] pb-[2px] pt-[10px] px-[2px] rounded-[1.67772e+07px] top-[722.43px] w-[24px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-2 border-[rgba(255,255,255,0.5)] border-solid inset-0 pointer-events-none rounded-[1.67772e+07px]" />
      <Hero />
    </div>
  );
}

function Hero1() {
  return (
    <div className="absolute content-stretch flex h-[113.5px] items-start left-0 top-[87px] w-[273px]" data-name="Hero">
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-[96px] not-italic relative shrink-0 text-[#363739] text-[96px] text-nowrap whitespace-pre">meets</p>
    </div>
  );
}

function Heading() {
  return (
    <div className="h-[288px] relative shrink-0 w-full" data-name="Heading 1">
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[96px] left-0 not-italic text-[96px] text-nowrap text-white top-px whitespace-pre">Intelligence</p>
      <Hero1 />
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[96px] left-0 not-italic text-[96px] text-nowrap text-white top-[193px] whitespace-pre">Wisdom</p>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="h-[78px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[39px] left-0 not-italic text-[24px] text-[rgba(255,255,255,0.9)] top-[0.5px] tracking-[0.0703px] w-[640px]">{`We create AI that doesn't just compute—it understands. Technology designed to make life kinder and more meaningful.`}</p>
    </div>
  );
}

function Icon() {
  return (
    <div className="absolute left-[168.19px] size-[20px] top-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d="M4.16667 10H15.8333" id="Vector" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p1ae0b780} id="Vector_2" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Hero2() {
  return (
    <div className="absolute bg-white h-[60px] left-0 rounded-[1.67772e+07px] top-0 w-[220.188px]" data-name="Hero">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-[96.5px] not-italic text-[#fc8d42] text-[16px] text-center text-nowrap top-[17.5px] tracking-[-0.3125px] translate-x-[-50%] whitespace-pre">Explore our vision</p>
      <Icon />
    </div>
  );
}

function Hero3() {
  return (
    <div className="absolute border-2 border-solid border-white h-[60px] left-[236.19px] rounded-[1.67772e+07px] top-0 w-[164.609px]" data-name="Hero">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-[80px] not-italic text-[16px] text-center text-nowrap text-white top-[15.5px] tracking-[-0.3125px] translate-x-[-50%] whitespace-pre">See products</p>
    </div>
  );
}

function Container5() {
  return (
    <div className="h-[60px] relative shrink-0 w-full" data-name="Container">
      <Hero2 />
      <Hero3 />
    </div>
  );
}

function Container6() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[24px] h-[490px] items-start left-[137.5px] top-[180.5px] w-[672px]" data-name="Container">
      <Heading />
      <Paragraph />
      <Container5 />
    </div>
  );
}

function Hero4() {
  return (
    <div className="bg-[#ffa569] h-[787px] overflow-clip relative shrink-0 w-full" data-name="Hero">
      <Container3 />
      <Container4 />
      <Container6 />
    </div>
  );
}

function Container7() {
  return <div className="absolute bg-gradient-to-l from-[rgba(255,165,105,0.05)] h-[1378px] left-[631.34px] to-[rgba(0,0,0,0)] top-0 w-[315.664px]" data-name="Container" />;
}

function Text() {
  return (
    <div className="absolute content-stretch flex h-[19px] items-start left-[16px] top-[10.5px] w-[88.375px]" data-name="Text">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[#fc8d42] text-[16px] text-nowrap tracking-[-0.3125px] whitespace-pre">About Eodin</p>
    </div>
  );
}

function About() {
  return (
    <div className="absolute bg-[rgba(255,165,105,0.1)] border border-[rgba(252,141,66,0.3)] border-solid h-[42px] left-0 rounded-[1.67772e+07px] top-0 w-[122.375px]" data-name="About">
      <Text />
    </div>
  );
}

function Text1() {
  return (
    <div className="absolute content-stretch flex h-[70.5px] items-start left-0 top-[54.5px] w-[289.102px]" data-name="Text">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[60px] not-italic relative shrink-0 text-[#fc8d42] text-[60px] text-nowrap tracking-[0.2637px] whitespace-pre">Intelligence</p>
    </div>
  );
}

function About1() {
  return (
    <div className="absolute h-[120px] left-0 top-[66px] w-[899px]" data-name="About">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[60px] left-0 not-italic text-[#363739] text-[60px] text-nowrap top-[0.5px] tracking-[0.2637px] whitespace-pre">The Wisdom Beyond</p>
      <Text1 />
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[16px] text-[rgba(54,55,57,0.8)] text-nowrap top-[-0.5px] tracking-[-0.3125px] whitespace-pre">{`At Eodin, we believe the future of AI isn't just about being faster or smarter—it's about being wiser.`}</p>
    </div>
  );
}

function Paragraph2() {
  return (
    <div className="h-[48px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[16px] text-[rgba(54,55,57,0.8)] top-[-0.5px] tracking-[-0.3125px] w-[863px]">Our name reflects our mission: to build artificial intelligence that understands not just what you say, but what you mean. Technology that respects your time, values your privacy, and genuinely improves your life.</p>
    </div>
  );
}

function Paragraph3() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#fc8d42] text-[16px] text-nowrap top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Because true intelligence is guided by wisdom.</p>
    </div>
  );
}

function About2() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[24px] h-[144px] items-start left-0 top-[202px] w-[899px]" data-name="About">
      <Paragraph1 />
      <Paragraph2 />
      <Paragraph3 />
    </div>
  );
}

function Container8() {
  return (
    <div className="[grid-area:1_/_1] opacity-0 place-self-stretch relative shrink-0" data-name="Container">
      <About />
      <About1 />
      <About2 />
    </div>
  );
}

function Icon1() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon">
          <path d={svgPaths.p199fee00} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d={svgPaths.p10e72800} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d={svgPaths.p2dfeeaef} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d={svgPaths.p191dbb80} id="Vector_4" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d={svgPaths.p30453a80} id="Vector_5" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d={svgPaths.p10ece300} id="Vector_6" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d={svgPaths.p1826df20} id="Vector_7" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d={svgPaths.p259d3500} id="Vector_8" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d={svgPaths.p2d1abb00} id="Vector_9" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function About3() {
  return (
    <div className="absolute bg-gradient-to-b content-stretch flex from-[#ffa569] items-center justify-center left-[26px] rounded-[14px] size-[48px] to-[#fc8d42] top-[26px]" data-name="About">
      <Icon1 />
    </div>
  );
}

function About4() {
  return (
    <div className="absolute h-[24px] left-[26px] top-[90px] w-[385.5px]" data-name="About">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#363739] text-[16px] text-nowrap top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Deep Understanding</p>
    </div>
  );
}

function About5() {
  return (
    <div className="absolute h-[40px] left-[26px] top-[122px] w-[385.5px]" data-name="About">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[14px] text-[rgba(54,55,57,0.7)] top-[0.5px] tracking-[-0.1504px] w-[354px]">AI that truly comprehends context, nuance, and human needs.</p>
    </div>
  );
}

function Container9() {
  return (
    <div className="[grid-area:1_/_1] bg-white opacity-0 place-self-stretch relative rounded-[16px] shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border-2 border-[rgba(255,192,149,0.3)] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <About3 />
      <About4 />
      <About5 />
    </div>
  );
}

function Icon2() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon">
          <path d={svgPaths.p1dff4600} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function About6() {
  return (
    <div className="absolute bg-gradient-to-b content-stretch flex from-[#ffa569] items-center justify-center left-[26px] rounded-[14px] size-[48px] to-[#fc8d42] top-[26px]" data-name="About">
      <Icon2 />
    </div>
  );
}

function About7() {
  return (
    <div className="absolute h-[24px] left-[26px] top-[90px] w-[385.5px]" data-name="About">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#363739] text-[16px] text-nowrap top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Built with Empathy</p>
    </div>
  );
}

function About8() {
  return (
    <div className="absolute h-[20px] left-[26px] top-[122px] w-[385.5px]" data-name="About">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[14px] text-[rgba(54,55,57,0.7)] text-nowrap top-[0.5px] tracking-[-0.1504px] whitespace-pre">Technology designed to care about what matters to people.</p>
    </div>
  );
}

function Container10() {
  return (
    <div className="[grid-area:1_/_2] bg-white opacity-0 place-self-stretch relative rounded-[16px] shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border-2 border-[rgba(255,192,149,0.3)] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <About6 />
      <About7 />
      <About8 />
    </div>
  );
}

function Icon3() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon">
          <path d={svgPaths.p1ea91d80} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M9 18H15" id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M10 22H14" id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function About9() {
  return (
    <div className="absolute bg-gradient-to-b content-stretch flex from-[#ffa569] items-center justify-center left-[26px] rounded-[14px] size-[48px] to-[#fc8d42] top-[26px]" data-name="About">
      <Icon3 />
    </div>
  );
}

function About10() {
  return (
    <div className="absolute h-[24px] left-[26px] top-[90px] w-[385.5px]" data-name="About">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#363739] text-[16px] text-nowrap top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Thoughtful Innovation</p>
    </div>
  );
}

function About11() {
  return (
    <div className="absolute h-[20px] left-[26px] top-[122px] w-[385.5px]" data-name="About">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[14px] text-[rgba(54,55,57,0.7)] text-nowrap top-[0.5px] tracking-[-0.1504px] whitespace-pre">Solutions that solve real problems in meaningful ways.</p>
    </div>
  );
}

function Container11() {
  return (
    <div className="[grid-area:2_/_1] bg-white opacity-0 place-self-stretch relative rounded-[16px] shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border-2 border-[rgba(255,192,149,0.3)] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <About9 />
      <About10 />
      <About11 />
    </div>
  );
}

function Icon4() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g id="Icon">
          <path d={svgPaths.p1d820380} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d={svgPaths.p27451300} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d={svgPaths.p2981fe00} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d={svgPaths.p161d4800} id="Vector_4" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function About12() {
  return (
    <div className="absolute bg-gradient-to-b content-stretch flex from-[#ffa569] items-center justify-center left-[26px] rounded-[14px] size-[48px] to-[#fc8d42] top-[26px]" data-name="About">
      <Icon4 />
    </div>
  );
}

function About13() {
  return (
    <div className="absolute h-[24px] left-[26px] top-[90px] w-[385.5px]" data-name="About">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#363739] text-[16px] text-nowrap top-[-0.5px] tracking-[-0.3125px] whitespace-pre">For Everyone</p>
    </div>
  );
}

function About14() {
  return (
    <div className="absolute h-[20px] left-[26px] top-[122px] w-[385.5px]" data-name="About">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[14px] text-[rgba(54,55,57,0.7)] text-nowrap top-[0.5px] tracking-[-0.1504px] whitespace-pre">Accessible, intuitive AI that serves all humanity.</p>
    </div>
  );
}

function Container12() {
  return (
    <div className="[grid-area:2_/_2] bg-white opacity-0 place-self-stretch relative rounded-[16px] shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border-2 border-[rgba(255,192,149,0.3)] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <About12 />
      <About13 />
      <About14 />
    </div>
  );
}

function Container13() {
  return (
    <div className="[grid-area:2_/_1] gap-[24px] grid grid-cols-[repeat(2,_minmax(0px,_1fr))] grid-rows-[188px_minmax(0px,_1fr)] place-self-stretch relative shrink-0" data-name="Container">
      <Container9 />
      <Container10 />
      <Container11 />
      <Container12 />
    </div>
  );
}

function Container14() {
  return (
    <div className="box-border gap-[80px] grid grid-cols-[repeat(1,_minmax(0px,_1fr))] grid-rows-[346px_minmax(0px,_1fr)] h-[806px] pr-0 py-0 relative shrink-0 w-full" data-name="Container">
      <Container8 />
      <Container13 />
    </div>
  );
}

function LineBreak() {
  return <div className="absolute h-[42.5px] left-[778.95px] top-[-1.5px] w-0" data-name="Line Break" />;
}

function Quote() {
  return (
    <div className="h-[80px] relative shrink-0 w-full" data-name="Quote">
      <p className="absolute font-['Inter:Italic',sans-serif] font-normal italic leading-[40px] left-[400.05px] text-[36px] text-center text-nowrap text-white top-[0.5px] tracking-[0.3691px] translate-x-[-50%] whitespace-pre">{`"Intelligence without wisdom is just computation.`}</p>
      <LineBreak />
      <p className="absolute font-['Inter:Italic',sans-serif] font-normal italic leading-[40px] left-[400.31px] text-[36px] text-center text-nowrap text-white top-[40.5px] tracking-[0.3691px] translate-x-[-50%] whitespace-pre">{`We're building something deeper."`}</p>
    </div>
  );
}

function Paragraph4() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[28px] left-[400.2px] not-italic text-[18px] text-[rgba(255,255,255,0.8)] text-center text-nowrap top-0 tracking-[-0.4395px] translate-x-[-50%] whitespace-pre">— The Eodin Philosophy</p>
    </div>
  );
}

function About15() {
  return (
    <div className="bg-gradient-to-b from-[#ffa569] h-[220px] relative rounded-[24px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] shrink-0 to-[#fc8d42] w-full" data-name="About">
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col gap-[16px] h-[220px] items-start pb-0 pt-[48px] px-[48px] relative w-full">
          <Quote />
          <Paragraph4 />
        </div>
      </div>
    </div>
  );
}

function Container15() {
  return (
    <div className="h-[220px] opacity-0 relative shrink-0 w-full" data-name="Container">
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col h-[220px] items-start px-[1.5px] py-0 relative w-full">
          <About15 />
        </div>
      </div>
    </div>
  );
}

function Container16() {
  return (
    <div className="absolute box-border content-stretch flex flex-col gap-[126px] h-[1122px] items-start left-0 px-[24px] py-0 top-[128px] w-[947px]" data-name="Container">
      <Container14 />
      <Container15 />
    </div>
  );
}

function About16() {
  return (
    <div className="h-[1378px] relative shrink-0 w-full" data-name="About">
      <Container7 />
      <Container16 />
    </div>
  );
}

function Container17() {
  return <div className="absolute h-[1977.88px] left-0 opacity-5 top-0 w-[947px]" data-name="Container" style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg viewBox=\\\'0 0 947 1977.9\\\' xmlns=\\\'http://www.w3.org/2000/svg\\\' preserveAspectRatio=\\\'none\\\'><rect x=\\\'0\\\' y=\\\'0\\\' height=\\\'100%\\\' width=\\\'100%\\\' fill=\\\'url(%23grad)\\\' opacity=\\\'1\\\'/><defs><radialGradient id=\\\'grad\\\' gradientUnits=\\\'userSpaceOnUse\\\' cx=\\\'0\\\' cy=\\\'0\\\' r=\\\'10\\\' gradientTransform=\\\'matrix(0 -109.64 -109.64 0 473.5 988.94)\\\'><stop stop-color=\\\'rgba(255,255,255,1)\\\' offset=\\\'0.001056\\\'/><stop stop-color=\\\'rgba(191,191,191,0.75)\\\' offset=\\\'0.00079197\\\'/><stop stop-color=\\\'rgba(128,128,128,0.5)\\\' offset=\\\'0.00052798\\\'/><stop stop-color=\\\'rgba(64,64,64,0.25)\\\' offset=\\\'0.00026399\\\'/><stop stop-color=\\\'rgba(0,0,0,0)\\\' offset=\\\'0\\\'/></radialGradient></defs></svg>')" }} />;
}

function Text2() {
  return (
    <div className="absolute content-stretch flex h-[19px] items-start left-[16px] top-[10.5px] w-[96.305px]" data-name="Text">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[16px] text-center text-nowrap text-white tracking-[-0.3125px] whitespace-pre">Our Products</p>
    </div>
  );
}

function Products() {
  return (
    <div className="absolute bg-[rgba(255,255,255,0.2)] border border-[rgba(255,255,255,0.3)] border-solid h-[42px] left-[384.34px] rounded-[1.67772e+07px] top-0 w-[130.305px]" data-name="Products">
      <Text2 />
    </div>
  );
}

function Text3() {
  return (
    <div className="absolute content-stretch flex h-[70.5px] items-start left-[361.78px] top-[54.5px] w-[175.43px]" data-name="Text">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[60px] not-italic relative shrink-0 text-[60px] text-[rgba(255,255,255,0.8)] text-center text-nowrap tracking-[0.2637px] whitespace-pre">real life</p>
    </div>
  );
}

function Products1() {
  return (
    <div className="absolute h-[120px] left-0 top-[66px] w-[899px]" data-name="Products">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[60px] left-[449.24px] not-italic text-[60px] text-center text-nowrap text-white top-[0.5px] tracking-[0.2637px] translate-x-[-50%] whitespace-pre">AI designed for</p>
      <Text3 />
    </div>
  );
}

function Products2() {
  return (
    <div className="absolute h-[56px] left-[65.5px] top-[210px] w-[768px]" data-name="Products">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[28px] left-[384.13px] not-italic text-[20px] text-[rgba(255,255,255,0.9)] text-center top-0 tracking-[-0.4492px] translate-x-[-50%] w-[748px]">Each product embodies our philosophy: intelligence guided by wisdom, designed with genuine care.</p>
    </div>
  );
}

function Container18() {
  return (
    <div className="h-[266px] opacity-0 relative shrink-0 w-full" data-name="Container">
      <Products />
      <Products1 />
      <Products2 />
    </div>
  );
}

function Group() {
  return (
    <div className="absolute inset-[7.89%_80.2%_7.89%_1.66%]" data-name="Group">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 27 27">
        <g id="Group">
          <path d={svgPaths.p19e96200} fill="var(--fill-0, #2563EB)" id="Vector" />
          <path d={svgPaths.p28407800} fill="var(--fill-0, #2563EB)" id="Vector_2" />
          <path d={svgPaths.p3fc56600} fill="var(--fill-0, #2563EB)" id="Vector_3" />
        </g>
      </svg>
    </div>
  );
}

function Group1() {
  return (
    <div className="absolute inset-[12.27%_0.01%_10.85%_23.31%]" data-name="Group">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 115 25">
        <g id="Group">
          <path d={svgPaths.pd360c80} fill="var(--fill-0, #2563EB)" id="Vector" />
          <path d={svgPaths.pe967d80} fill="var(--fill-0, #2563EB)" id="Vector_2" />
          <path d={svgPaths.p3c65bf80} fill="var(--fill-0, #2563EB)" id="Vector_3" />
          <path d={svgPaths.p3c506e80} fill="var(--fill-0, #2563EB)" id="Vector_4" />
          <path d={svgPaths.p7406080} fill="var(--fill-0, #2563EB)" id="Vector_5" />
          <path d={svgPaths.p22d4df00} fill="var(--fill-0, #2563EB)" id="Vector_6" />
          <path d={svgPaths.p11525480} fill="var(--fill-0, #2563EB)" id="Vector_7" />
          <path d={svgPaths.p2a72d80} fill="var(--fill-0, #2563EB)" id="Vector_8" />
          <path d={svgPaths.p34035800} fill="var(--fill-0, #2563EB)" id="Vector_9" />
          <path d={svgPaths.p13d39d00} fill="var(--fill-0, #2563EB)" id="Vector_10" />
        </g>
      </svg>
    </div>
  );
}

function Icon5() {
  return (
    <div className="absolute h-[32px] left-0 overflow-clip top-0 w-[148.891px]" data-name="Icon">
      <Group />
      <Group1 />
    </div>
  );
}

function LinkgoLogoClean() {
  return (
    <div className="absolute h-[32px] left-[32px] top-[32px] w-[148.891px]" data-name="LinkgoLogoClean">
      <Icon5 />
    </div>
  );
}

function Paragraph5() {
  return (
    <div className="absolute h-[28px] left-[32px] top-[86px] w-[222.266px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[28px] left-0 not-italic text-[#fc8d42] text-[20px] text-nowrap top-0 tracking-[-0.4492px] whitespace-pre">Your AI tools marketplace</p>
    </div>
  );
}

function Paragraph6() {
  return (
    <div className="absolute h-[146.25px] left-[32px] top-[130px] w-[369.5px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[29.25px] left-0 not-italic text-[18px] text-[rgba(54,55,57,0.8)] top-[0.5px] tracking-[-0.4395px] w-[355px]">The ultimate AI tool marketplace where businesses and developers discover, compare, and integrate the best AI solutions tailored to their specific needs and requirements.</p>
    </div>
  );
}

function Text4() {
  return (
    <div className="basis-0 grow h-[24px] min-h-px min-w-px relative shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[24px] relative w-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#fc8d42] text-[16px] text-nowrap top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Learn more</p>
      </div>
    </div>
  );
}

function Icon6() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d={svgPaths.p3e47bd00} id="Vector" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p3610fb80} id="Vector_2" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Link() {
  return (
    <div className="absolute content-stretch flex gap-[8px] h-[24px] items-center left-[32px] top-[300.25px] w-[110px]" data-name="Link">
      <Text4 />
      <Icon6 />
    </div>
  );
}

function Container19() {
  return (
    <div className="absolute h-[356.25px] left-0 top-[270.94px] w-[433.5px]" data-name="Container">
      <LinkgoLogoClean />
      <Paragraph5 />
      <Paragraph6 />
      <Link />
    </div>
  );
}

function ImageWithFallback() {
  return (
    <div className="absolute h-[270.938px] left-0 top-0 w-[433.5px]" data-name="ImageWithFallback">
      <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgImageWithFallback} />
    </div>
  );
}

function Container20() {
  return <div className="absolute bg-gradient-to-b from-[#fc8d42] h-[270.938px] left-0 opacity-20 to-[#faa668] top-0 w-[433.5px]" data-name="Container" />;
}

function Container21() {
  return (
    <div className="absolute h-[270.938px] left-0 overflow-clip top-0 w-[433.5px]" data-name="Container">
      <ImageWithFallback />
      <Container20 />
    </div>
  );
}

function Group2() {
  return (
    <div className="absolute contents inset-[7.89%_7.89%_7.89%_7.74%]" data-name="Group">
      <div className="absolute inset-[7.89%_7.89%_7.89%_23.14%] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[-9.256px_-3.156px] mask-size-[40px_40px]" data-name="Vector" style={{ maskImage: `url('${imgVector}')` }}>
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 28 34">
          <path d={svgPaths.p304db230} fill="var(--fill-0, #2563EB)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[43.27%_41.46%_43.4%_7.74%] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[-3.095px_-17.308px] mask-size-[40px_40px]" data-name="Vector" style={{ maskImage: `url('${imgVector}')` }}>
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 21 6">
          <path d={svgPaths.p3f657a00} fill="var(--fill-0, #2563EB)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[32.7%_32.27%_32.18%_46.88%] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[-18.753px_-13.079px] mask-size-[40px_40px]" data-name="Vector" style={{ maskImage: `url('${imgVector}')` }}>
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 9 15">
          <path d={svgPaths.p1b7a3680} fill="var(--fill-0, #2563EB)" id="Vector" />
        </svg>
      </div>
    </div>
  );
}

function ClipPathGroup() {
  return (
    <div className="absolute contents inset-0" data-name="Clip path group">
      <Group2 />
    </div>
  );
}

function Icon7() {
  return (
    <div className="h-[40px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <ClipPathGroup />
    </div>
  );
}

function LinkgoIcon() {
  return (
    <div className="relative shrink-0 size-[40px]" data-name="LinkgoIcon">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col items-start relative size-[40px]">
        <Icon7 />
      </div>
    </div>
  );
}

function Container22() {
  return (
    <div className="absolute bg-white box-border content-stretch flex items-center justify-center left-[345.5px] rounded-[16px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] size-[64px] top-[24px]" data-name="Container">
      <LinkgoIcon />
    </div>
  );
}

function Container23() {
  return (
    <div className="absolute h-[270.938px] left-0 top-0 w-[433.5px]" data-name="Container">
      <Container21 />
      <Container22 />
    </div>
  );
}

function Container24() {
  return (
    <div className="absolute bg-[rgba(255,255,255,0.95)] h-[627.188px] left-0 opacity-0 overflow-clip rounded-[24px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] top-[50px] w-[433.5px]" data-name="Container">
      <Container19 />
      <Container23 />
    </div>
  );
}

function Group3() {
  return (
    <div className="absolute bottom-[0.14%] left-0 mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0px] mask-size-[132.925px_31.954px] right-[0.04%] top-0" data-name="Group" style={{ maskImage: `url('${imgGroup}')` }}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 133 32">
        <g id="Group">
          <g id="Group_2">
            <path d={svgPaths.p3c4e3100} fill="var(--fill-0, black)" id="Vector" />
            <path d={svgPaths.p1dd4a600} fill="var(--fill-0, black)" id="Vector_2" />
            <path d={svgPaths.p361c1280} fill="var(--fill-0, black)" id="Vector_3" />
            <path d={svgPaths.p2868b300} fill="var(--fill-0, black)" id="Vector_4" />
            <path d={svgPaths.p18186df0} fill="var(--fill-0, black)" id="Vector_5" />
            <path d={svgPaths.p3d42ff80} fill="var(--fill-0, black)" id="Vector_6" />
            <path d={svgPaths.p119fbc80} fill="var(--fill-0, black)" id="Vector_7" />
            <path d={svgPaths.pe88e80} fill="var(--fill-0, black)" id="Vector_8" />
            <path d={svgPaths.pf9ff700} fill="var(--fill-0, black)" id="Vector_9" />
          </g>
          <path d={svgPaths.p115c00} fill="var(--fill-0, black)" id="Vector_10" />
        </g>
      </svg>
    </div>
  );
}

function ClipPathGroup1() {
  return (
    <div className="absolute bottom-[0.14%] contents left-0 right-[0.04%] top-0" data-name="Clip path group">
      <Group3 />
    </div>
  );
}

function Icon8() {
  return (
    <div className="absolute h-[32px] left-0 overflow-clip top-0 w-[132.984px]" data-name="Icon">
      <ClipPathGroup1 />
    </div>
  );
}

function AdariaLogo() {
  return (
    <div className="absolute h-[32px] left-[32px] top-[32px] w-[132.984px]" data-name="AdariaLogo">
      <Icon8 />
    </div>
  );
}

function Paragraph7() {
  return (
    <div className="absolute h-[28px] left-[32px] top-[86px] w-[333.914px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[28px] left-0 not-italic text-[#fc8d42] text-[20px] text-nowrap top-0 tracking-[-0.4492px] whitespace-pre">Advertising automation, revolutionized</p>
    </div>
  );
}

function Paragraph8() {
  return (
    <div className="absolute h-[146.25px] left-[32px] top-[130px] w-[369.5px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[29.25px] left-0 not-italic text-[18px] text-[rgba(54,55,57,0.8)] top-[0.5px] tracking-[-0.4395px] w-[365px]">A revolutionary advertising automation platform that leverages advanced AI to optimize campaigns, maximize ROI, and streamline digital marketing workflows across multiple channels.</p>
    </div>
  );
}

function Text5() {
  return (
    <div className="basis-0 grow h-[24px] min-h-px min-w-px relative shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[24px] relative w-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#fc8d42] text-[16px] text-nowrap top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Learn more</p>
      </div>
    </div>
  );
}

function Icon9() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d={svgPaths.p3e47bd00} id="Vector" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p3610fb80} id="Vector_2" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Link1() {
  return (
    <div className="absolute content-stretch flex gap-[8px] h-[24px] items-center left-[32px] top-[300.25px] w-[110px]" data-name="Link">
      <Text5 />
      <Icon9 />
    </div>
  );
}

function Container25() {
  return (
    <div className="absolute h-[356.25px] left-0 top-[270.94px] w-[433.5px]" data-name="Container">
      <AdariaLogo />
      <Paragraph7 />
      <Paragraph8 />
      <Link1 />
    </div>
  );
}

function ImageWithFallback1() {
  return (
    <div className="absolute h-[270.938px] left-0 top-0 w-[433.5px]" data-name="ImageWithFallback">
      <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgImageWithFallback1} />
    </div>
  );
}

function Container26() {
  return <div className="absolute bg-gradient-to-b from-[#faa668] h-[270.938px] left-0 opacity-20 to-[#ffc095] top-0 w-[433.5px]" data-name="Container" />;
}

function Container27() {
  return (
    <div className="absolute h-[270.938px] left-0 overflow-clip top-0 w-[433.5px]" data-name="Container">
      <ImageWithFallback1 />
      <Container26 />
    </div>
  );
}

function Icon10() {
  return (
    <div className="h-[32px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute bottom-[5.37%] left-0 right-[0.93%] top-[5%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 29">
          <path d={svgPaths.p791daf0} fill="var(--fill-0, black)" id="Vector" />
        </svg>
      </div>
    </div>
  );
}

function AdariaIcon() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="AdariaIcon">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col items-start relative size-[32px]">
        <Icon10 />
      </div>
    </div>
  );
}

function Container28() {
  return (
    <div className="absolute bg-white box-border content-stretch flex items-center justify-center left-[345.5px] rounded-[16px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] size-[64px] top-[24px]" data-name="Container">
      <AdariaIcon />
    </div>
  );
}

function Container29() {
  return (
    <div className="absolute h-[270.938px] left-0 top-0 w-[433.5px]" data-name="Container">
      <Container27 />
      <Container28 />
    </div>
  );
}

function Container30() {
  return (
    <div className="absolute bg-[rgba(255,255,255,0.95)] h-[627.188px] left-[465.5px] opacity-0 overflow-clip rounded-[24px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] top-[50px] w-[433.5px]" data-name="Container">
      <Container25 />
      <Container29 />
    </div>
  );
}

function Heading1() {
  return (
    <div className="absolute content-stretch flex h-[36px] items-start left-[32px] top-[32px] w-[166.555px]" data-name="Heading 3">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[36px] not-italic relative shrink-0 text-[#363739] text-[30px] text-nowrap tracking-[0.3955px] whitespace-pre">New Product</p>
    </div>
  );
}

function Paragraph9() {
  return (
    <div className="absolute h-[28px] left-[32px] top-[76px] w-[118.195px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[28px] left-0 not-italic text-[#fc8d42] text-[20px] text-nowrap top-0 tracking-[-0.4492px] whitespace-pre">Coming Soon</p>
    </div>
  );
}

function Paragraph10() {
  return (
    <div className="absolute h-[87.75px] left-[32px] top-[120px] w-[369.5px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[29.25px] left-0 not-italic text-[18px] text-[rgba(54,55,57,0.8)] top-[0.5px] tracking-[-0.4395px] w-[350px]">{`We're crafting something special. A new AI solution that brings wisdom and care to everyday moments. Stay tuned for updates.`}</p>
    </div>
  );
}

function Text6() {
  return (
    <div className="absolute h-[24px] left-[32px] top-[231.75px] w-[113.328px]" data-name="Text">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[16px] text-[rgba(252,141,66,0.5)] text-nowrap top-[-0.5px] tracking-[-0.3125px] whitespace-pre">In Development</p>
    </div>
  );
}

function Container31() {
  return (
    <div className="absolute h-[287.75px] left-0 top-[270.94px] w-[433.5px]" data-name="Container">
      <Heading1 />
      <Paragraph9 />
      <Paragraph10 />
      <Text6 />
    </div>
  );
}

function ImageWithFallback2() {
  return (
    <div className="absolute h-[270.938px] left-0 top-0 w-[433.5px]" data-name="ImageWithFallback">
      <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgImageWithFallback2} />
    </div>
  );
}

function Container32() {
  return <div className="absolute bg-gradient-to-b from-[#ffa569] h-[270.938px] left-0 opacity-20 to-[#fc8d42] top-0 w-[433.5px]" data-name="Container" />;
}

function Text7() {
  return (
    <div className="content-stretch flex h-[19px] items-start relative shrink-0 w-full" data-name="Text">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[#fc8d42] text-[16px] text-nowrap tracking-[-0.3125px] whitespace-pre">Coming Soon</p>
    </div>
  );
}

function Container33() {
  return (
    <div className="bg-[rgba(255,255,255,0.95)] h-[48px] relative rounded-[1.67772e+07px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] shrink-0 w-[145.367px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col h-[48px] items-start pb-0 pt-[14.5px] px-[24px] relative w-[145.367px]">
        <Text7 />
      </div>
    </div>
  );
}

function Container34() {
  return (
    <div className="absolute bg-[rgba(54,55,57,0.1)] box-border content-stretch flex h-[270.938px] items-center justify-center left-0 pl-0 pr-[0.008px] py-0 top-0 w-[433.5px]" data-name="Container">
      <Container33 />
    </div>
  );
}

function Container35() {
  return (
    <div className="absolute h-[270.938px] left-0 overflow-clip top-0 w-[433.5px]" data-name="Container">
      <ImageWithFallback2 />
      <Container32 />
      <Container34 />
    </div>
  );
}

function Icon11() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <g id="Icon">
          <path d={svgPaths.p858370} id="Vector" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          <path d="M26.6667 4V9.33333" id="Vector_2" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          <path d="M29.3333 6.66667H24" id="Vector_3" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          <path d="M5.33333 22.6667V25.3333" id="Vector_4" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          <path d="M6.66667 24H4" id="Vector_5" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
        </g>
      </svg>
    </div>
  );
}

function Container36() {
  return (
    <div className="absolute bg-white box-border content-stretch flex items-center justify-center left-[345.5px] rounded-[16px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] size-[64px] top-[24px]" data-name="Container">
      <Icon11 />
    </div>
  );
}

function Container37() {
  return (
    <div className="absolute h-[270.938px] left-0 top-0 w-[433.5px]" data-name="Container">
      <Container35 />
      <Container36 />
    </div>
  );
}

function Container38() {
  return (
    <div className="absolute bg-[rgba(255,255,255,0.95)] h-[558.688px] left-0 opacity-0 overflow-clip rounded-[24px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] top-[709.19px] w-[433.5px]" data-name="Container">
      <Container31 />
      <Container37 />
    </div>
  );
}

function Container39() {
  return (
    <div className="h-[1217.88px] relative shrink-0 w-full" data-name="Container">
      <Container24 />
      <Container30 />
      <Container38 />
    </div>
  );
}

function Text8() {
  return (
    <div className="absolute content-stretch flex h-[23.5px] items-start left-[130.41px] top-[2px] w-[119.047px]" data-name="Text">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[28px] not-italic relative shrink-0 text-[20px] text-[rgba(255,255,255,0.8)] text-center text-nowrap tracking-[-0.4492px] whitespace-pre">Lasting good.</p>
    </div>
  );
}

function Paragraph11() {
  return (
    <div className="absolute h-[28px] left-[33px] top-[17px] w-[249.453px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[28px] left-[65px] not-italic text-[20px] text-center text-nowrap text-white top-0 tracking-[-0.4492px] translate-x-[-50%] whitespace-pre">Small wisdom.</p>
      <Text8 />
    </div>
  );
}

function Products3() {
  return (
    <div className="bg-[rgba(255,255,255,0.2)] h-[62px] relative rounded-[1.67772e+07px] shrink-0 w-full" data-name="Products">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.3)] border-solid inset-0 pointer-events-none rounded-[1.67772e+07px]" />
      <Paragraph11 />
    </div>
  );
}

function Container40() {
  return (
    <div className="h-[62px] opacity-0 relative shrink-0 w-full" data-name="Container">
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col h-[62px] items-start px-[291.773px] py-0 relative w-full">
          <Products3 />
        </div>
      </div>
    </div>
  );
}

function Container41() {
  return (
    <div className="absolute box-border content-stretch flex flex-col gap-[50px] h-[1721.88px] items-start left-0 pb-0 pt-[30px] px-[24px] top-[128px] w-[947px]" data-name="Container">
      <Container18 />
      <Container39 />
      <Container40 />
    </div>
  );
}

function Products4() {
  return (
    <div className="bg-[#ffa569] h-[1977.88px] relative shrink-0 w-full" data-name="Products">
      <Container17 />
      <Container41 />
    </div>
  );
}

function Container42() {
  return <div className="absolute bg-[#ffa569] blur-3xl filter left-[244.23px] opacity-10 rounded-[1.67772e+07px] size-[393.321px] top-[368.71px]" data-name="Container" />;
}

function Container43() {
  return <div className="absolute bg-[#fc8d42] blur-3xl filter left-[279.49px] opacity-10 rounded-[1.67772e+07px] size-[434.068px] top-[711.09px]" data-name="Container" />;
}

function Container44() {
  return (
    <div className="absolute h-[1493.5px] left-0 top-0 w-[947px]" data-name="Container">
      <Container42 />
      <Container43 />
    </div>
  );
}

function Text9() {
  return (
    <div className="absolute content-stretch flex h-[19px] items-start left-[16px] top-[10.5px] w-[75px]" data-name="Text">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[16px] text-center text-nowrap text-white tracking-[-0.3125px] whitespace-pre">Our Vision</p>
    </div>
  );
}

function Vision() {
  return (
    <div className="absolute bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] border-solid h-[42px] left-[395px] rounded-[1.67772e+07px] top-0 w-[109px]" data-name="Vision">
      <Text9 />
    </div>
  );
}

function Text10() {
  return (
    <div className="absolute content-stretch flex h-[70.5px] items-start left-[305.5px] top-[54.5px] w-[287.992px]" data-name="Text">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[60px] not-italic relative shrink-0 text-[#ffa569] text-[60px] text-center text-nowrap tracking-[0.2637px] whitespace-pre">intelligence</p>
    </div>
  );
}

function Vision1() {
  return (
    <div className="absolute h-[120px] left-0 top-[66px] w-[899px]" data-name="Vision">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[60px] left-[449.02px] not-italic text-[60px] text-center text-nowrap text-white top-[0.5px] tracking-[0.2637px] translate-x-[-50%] whitespace-pre">The wisdom beyond</p>
      <Text10 />
    </div>
  );
}

function Vision2() {
  return (
    <div className="absolute h-[97.5px] left-[65.5px] top-[218px] w-[768px]" data-name="Vision">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[32.5px] left-[384px] not-italic text-[20px] text-[rgba(255,255,255,0.8)] text-center top-[-0.5px] tracking-[-0.4492px] translate-x-[-50%] w-[731px]">{`The future of AI isn't about replacing people—it's about understanding them. We envision a world where technology feels human, learns with empathy, and makes life quietly better.`}</p>
    </div>
  );
}

function Container45() {
  return (
    <div className="absolute h-[315.5px] left-[24px] opacity-0 top-[30px] w-[899px]" data-name="Container">
      <Vision />
      <Vision1 />
      <Vision2 />
    </div>
  );
}

function Vision3() {
  return <div className="absolute blur-xl filter h-[270px] left-0 rounded-[24px] top-0 w-[278.328px]" data-name="Vision" />;
}

function Icon12() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <g id="Icon">
          <path d={svgPaths.p1dee4500} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          <path d={svgPaths.p1fa92f00} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          <path d={svgPaths.p230c5e00} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
        </g>
      </svg>
    </div>
  );
}

function Container46() {
  return (
    <div className="absolute bg-gradient-to-b content-stretch flex from-[#ffa569] items-center justify-center left-[32px] rounded-[16px] size-[64px] to-[#fc8d42] top-[32px]" data-name="Container">
      <Icon12 />
    </div>
  );
}

function Heading3() {
  return (
    <div className="absolute h-[32px] left-[32px] top-[120px] w-[212.328px]" data-name="Heading 3">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[32px] left-0 not-italic text-[24px] text-nowrap text-white top-0 tracking-[0.0703px] whitespace-pre">Human-First AI</p>
    </div>
  );
}

function Paragraph12() {
  return (
    <div className="absolute h-[72px] left-[32px] top-[164px] w-[212.328px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[16px] text-[rgba(255,255,255,0.7)] top-[-0.5px] tracking-[-0.3125px] w-[189px]">Technology that adapts to people, not the other way around.</p>
    </div>
  );
}

function Vision4() {
  return (
    <div className="absolute bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid h-[270px] left-0 rounded-[24px] top-0 w-[278.328px]" data-name="Vision">
      <Container46 />
      <Heading3 />
      <Paragraph12 />
    </div>
  );
}

function Container47() {
  return (
    <div className="absolute h-[270px] left-0 opacity-0 top-[30px] w-[278.328px]" data-name="Container">
      <Vision3 />
      <Vision4 />
    </div>
  );
}

function Vision5() {
  return <div className="absolute blur-xl filter h-[270px] left-0 rounded-[24px] top-0 w-[278.336px]" data-name="Vision" />;
}

function Icon13() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <g id="Icon">
          <path d={svgPaths.p2b2cc900} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          <path d={svgPaths.p1dee4500} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
        </g>
      </svg>
    </div>
  );
}

function Container48() {
  return (
    <div className="absolute bg-gradient-to-b content-stretch flex from-[#ffa569] items-center justify-center left-[32px] rounded-[16px] size-[64px] to-[#fc8d42] top-[32px]" data-name="Container">
      <Icon13 />
    </div>
  );
}

function Heading4() {
  return (
    <div className="absolute h-[32px] left-[32px] top-[120px] w-[212.336px]" data-name="Heading 3">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[32px] left-0 not-italic text-[24px] text-nowrap text-white top-0 tracking-[0.0703px] whitespace-pre">Ethical Innovation</p>
    </div>
  );
}

function Paragraph13() {
  return (
    <div className="absolute h-[72px] left-[32px] top-[164px] w-[212.336px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[16px] text-[rgba(255,255,255,0.7)] top-[-0.5px] tracking-[-0.3125px] w-[190px]">Building AI with transparency, privacy, and responsibility at its core.</p>
    </div>
  );
}

function Vision6() {
  return (
    <div className="absolute bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid h-[270px] left-0 rounded-[24px] top-0 w-[278.336px]" data-name="Vision">
      <Container48 />
      <Heading4 />
      <Paragraph13 />
    </div>
  );
}

function Container49() {
  return (
    <div className="absolute h-[270px] left-[310.33px] opacity-0 top-[30px] w-[278.336px]" data-name="Container">
      <Vision5 />
      <Vision6 />
    </div>
  );
}

function Vision7() {
  return <div className="absolute blur-xl filter h-[270px] left-0 rounded-[24px] top-0 w-[278.336px]" data-name="Vision" />;
}

function Icon14() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <g id="Icon">
          <path d={svgPaths.pf3a3a00} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          <path d={svgPaths.p34431d00} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          <path d={svgPaths.p3b4b8cc0} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          <path d={svgPaths.p2f8d9f80} id="Vector_4" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
        </g>
      </svg>
    </div>
  );
}

function Container50() {
  return (
    <div className="absolute bg-gradient-to-b content-stretch flex from-[#ffa569] items-center justify-center left-[32px] rounded-[16px] size-[64px] to-[#fc8d42] top-[32px]" data-name="Container">
      <Icon14 />
    </div>
  );
}

function Heading5() {
  return (
    <div className="absolute h-[32px] left-[32px] top-[120px] w-[212.336px]" data-name="Heading 3">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[32px] left-0 not-italic text-[24px] text-nowrap text-white top-0 tracking-[0.0703px] whitespace-pre">Accessible Future</p>
    </div>
  );
}

function Paragraph14() {
  return (
    <div className="absolute h-[72px] left-[32px] top-[164px] w-[212.336px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[16px] text-[rgba(255,255,255,0.7)] top-[-0.5px] tracking-[-0.3125px] w-[206px]">Making powerful AI available and beneficial to everyone, everywhere.</p>
    </div>
  );
}

function Vision8() {
  return (
    <div className="absolute bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid h-[270px] left-0 rounded-[24px] top-0 w-[278.336px]" data-name="Vision">
      <Container50 />
      <Heading5 />
      <Paragraph14 />
    </div>
  );
}

function Container51() {
  return (
    <div className="absolute h-[270px] left-[620.66px] opacity-0 top-[30px] w-[278.336px]" data-name="Container">
      <Vision7 />
      <Vision8 />
    </div>
  );
}

function Container52() {
  return (
    <div className="absolute h-[270px] left-[24px] top-[395.5px] w-[899px]" data-name="Container">
      <Container47 />
      <Container49 />
      <Container51 />
    </div>
  );
}

function Text11() {
  return (
    <div className="absolute content-stretch flex h-[50.85px] items-start left-[330.37px] top-[55.35px] w-[333.661px]" data-name="Text">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[60px] not-italic relative shrink-0 text-[#ffa569] text-[48px] text-center text-nowrap tracking-[0.3516px] whitespace-pre">guided by wisdom</p>
    </div>
  );
}

function Heading6() {
  return (
    <div className="absolute h-[108px] left-[68.95px] opacity-0 top-[751.5px] w-[809.1px]" data-name="Heading 3">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[60px] left-[404.57px] not-italic text-[48px] text-center text-nowrap text-white top-[0.35px] tracking-[0.3516px] translate-x-[-50%] whitespace-pre">Because the most powerful intelligence</p>
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[60px] left-[238.06px] not-italic text-[48px] text-center text-nowrap text-white top-[54.35px] tracking-[0.3516px] translate-x-[-50%] whitespace-pre">is the one</p>
      <Text11 />
    </div>
  );
}

function Heading7() {
  return (
    <div className="absolute content-stretch flex h-[36px] items-start left-[48px] top-[48px] w-[800px]" data-name="Heading 3">
      <p className="basis-0 font-['Inter:Regular',sans-serif] font-normal grow leading-[36px] min-h-px min-w-px not-italic relative shrink-0 text-[30px] text-center text-white tracking-[0.3955px]">{`Let's build something wise together`}</p>
    </div>
  );
}

function Paragraph15() {
  return (
    <div className="absolute h-[56px] left-[48px] top-[100px] w-[800px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[28px] left-[400px] not-italic text-[18px] text-[rgba(255,255,255,0.9)] text-center top-0 tracking-[-0.4395px] translate-x-[-50%] w-[797px]">{`Whether you're curious about our products, want to explore partnerships, or just want to chat about the future of AI—we'd love to hear from you.`}</p>
    </div>
  );
}

function Icon15() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d={svgPaths.p24d83580} id="Vector" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.pd919a80} id="Vector_2" stroke="var(--stroke-0, #FC8D42)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Text12() {
  return (
    <div className="basis-0 grow h-[24px] min-h-px min-w-px relative shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[24px] relative w-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-[44.5px] not-italic text-[#fc8d42] text-[16px] text-center text-nowrap top-[-0.5px] tracking-[-0.3125px] translate-x-[-50%] whitespace-pre">Get in touch</p>
      </div>
    </div>
  );
}

function Link2() {
  return (
    <div className="absolute bg-white box-border content-stretch flex gap-[8px] h-[56px] items-center left-[357.85px] px-[32px] py-0 rounded-[1.67772e+07px] top-[188px] w-[180.289px]" data-name="Link">
      <Icon15 />
      <Text12 />
    </div>
  );
}

function Container53() {
  return (
    <div className="absolute bg-gradient-to-b from-[#ffa569] h-[292px] left-[25.5px] opacity-0 rounded-[24px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] to-[#fc8d42] top-[975.5px] w-[896px]" data-name="Container">
      <Heading7 />
      <Paragraph15 />
      <Link2 />
    </div>
  );
}

function Container54() {
  return (
    <div className="absolute h-[1237.5px] left-0 top-[128px] w-[947px]" data-name="Container">
      <Container45 />
      <Container52 />
      <Heading6 />
      <Container53 />
    </div>
  );
}

function Vision9() {
  return (
    <div className="bg-gradient-to-b from-[#363739] h-[1493.5px] overflow-clip relative shrink-0 to-[#363739] via-50% via-[#2a2b2d] w-full" data-name="Vision">
      <Container44 />
      <Container54 />
    </div>
  );
}

function Icon16() {
  return (
    <div className="h-[32px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[1.11%]" data-name="Vector">
        <div className="absolute inset-[-1.14%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
            <path d={svgPaths.p30d97fd0} fill="var(--fill-0, white)" id="Vector" stroke="var(--stroke-0, #FFC095)" strokeWidth="0.711111" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[16.67%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
          <path d={svgPaths.pabd2680} fill="var(--fill-0, #FC8D42)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[28.23%_28.23%_16.67%_16.67%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
          <path d={svgPaths.p14935300} fill="var(--fill-0, #363739)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[28.23%_28.23%_16.67%_16.67%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
          <path d={svgPaths.p1def4e00} fill="var(--fill-0, #FAA668)" id="Vector" />
        </svg>
      </div>
    </div>
  );
}

function Container55() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col items-start relative size-[32px]">
        <Icon16 />
      </div>
    </div>
  );
}

function Icon17() {
  return (
    <div className="h-[30px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[30.34%_2.05%_2.39%_79.64%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 21">
          <path d={svgPaths.p27770a0} fill="var(--fill-0, white)" id="Vector" />
        </svg>
      </div>
      <div className="absolute bottom-[2.39%] left-[68.82%] right-[24.13%] top-0" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7 30">
          <path d={svgPaths.p1a7be400} fill="var(--fill-0, white)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[2.15%_35.12%_0.87%_45.64%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19 30">
          <path d={svgPaths.p93b6a00} fill="var(--fill-0, white)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[30.34%_57.1%_0.87%_22.81%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 21">
          <path d={svgPaths.pb8b9900} fill="var(--fill-0, white)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[6.07%_79.74%_2.39%_1.79%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19 28">
          <path d={svgPaths.p104cf00} fill="var(--fill-0, white)" id="Vector" />
        </svg>
      </div>
    </div>
  );
}

function Container56() {
  return (
    <div className="h-[30px] relative shrink-0 w-[98px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col h-[30px] items-start relative w-[98px]">
        <Icon17 />
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="absolute content-stretch flex gap-[10px] h-[32px] items-center left-0 top-0 w-[425.5px]" data-name="Logo">
      <Container55 />
      <Container56 />
    </div>
  );
}

function Paragraph16() {
  return (
    <div className="absolute h-[56px] left-0 top-[56px] w-[384px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[28px] left-0 not-italic text-[18px] text-[rgba(255,255,255,0.9)] top-0 tracking-[-0.4395px] w-[348px]">{`The wisdom behind intelligence. Building AI that's not just smart, but truly wise.`}</p>
    </div>
  );
}

function Icon18() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d={svgPaths.p188b5880} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Link3() {
  return (
    <div className="bg-[rgba(255,255,255,0.2)] relative rounded-[1.67772e+07px] shrink-0 size-[48px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex items-center justify-center relative size-[48px]">
        <Icon18 />
      </div>
    </div>
  );
}

function Icon19() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d={svgPaths.p1bcdee00} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M5 7.5H1.66667V17.5H5V7.5Z" id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p25677470} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Link4() {
  return (
    <div className="bg-[rgba(255,255,255,0.2)] relative rounded-[1.67772e+07px] shrink-0 size-[48px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex items-center justify-center relative size-[48px]">
        <Icon19 />
      </div>
    </div>
  );
}

function Icon20() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d={svgPaths.p5260b80} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p5272800} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Link5() {
  return (
    <div className="bg-[rgba(255,255,255,0.2)] relative rounded-[1.67772e+07px] shrink-0 size-[48px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex items-center justify-center relative size-[48px]">
        <Icon20 />
      </div>
    </div>
  );
}

function Icon21() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path d={svgPaths.p24d83580} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.pd919a80} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Link6() {
  return (
    <div className="bg-[rgba(255,255,255,0.2)] relative rounded-[1.67772e+07px] shrink-0 size-[48px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex items-center justify-center relative size-[48px]">
        <Icon21 />
      </div>
    </div>
  );
}

function Container57() {
  return (
    <div className="absolute content-stretch flex gap-[12px] h-[48px] items-start left-0 top-[136px] w-[425.5px]" data-name="Container">
      <Link3 />
      <Link4 />
      <Link5 />
      <Link6 />
    </div>
  );
}

function Container58() {
  return (
    <div className="[grid-area:1_/_1] place-self-stretch relative shrink-0" data-name="Container">
      <Logo />
      <Paragraph16 />
      <Container57 />
    </div>
  );
}

function Heading2() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Heading 4">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Company</p>
    </div>
  );
}

function Link7() {
  return (
    <div className="absolute content-stretch flex h-[19px] items-start left-0 top-[2.5px] w-[43.648px]" data-name="Link">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.8)] text-nowrap tracking-[-0.3125px] whitespace-pre">About</p>
    </div>
  );
}

function ListItem() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="List Item">
      <Link7 />
    </div>
  );
}

function Link8() {
  return (
    <div className="absolute content-stretch flex h-[19px] items-start left-0 top-[2.5px] w-[43.977px]" data-name="Link">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.8)] text-nowrap tracking-[-0.3125px] whitespace-pre">Vision</p>
    </div>
  );
}

function ListItem1() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="List Item">
      <Link8 />
    </div>
  );
}

function List() {
  return (
    <div className="content-stretch flex flex-col gap-[12px] h-[60px] items-start relative shrink-0 w-full" data-name="List">
      <ListItem />
      <ListItem1 />
    </div>
  );
}

function Container59() {
  return (
    <div className="[grid-area:1_/_2] content-stretch flex flex-col gap-[16px] items-start place-self-stretch relative shrink-0" data-name="Container">
      <Heading2 />
      <List />
    </div>
  );
}

function Heading8() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Heading 4">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Products</p>
    </div>
  );
}

function Link9() {
  return (
    <div className="absolute content-stretch flex h-[19px] items-start left-0 top-[2.5px] w-[48px]" data-name="Link">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.8)] text-nowrap tracking-[-0.3125px] whitespace-pre">Linkgo</p>
    </div>
  );
}

function ListItem2() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="List Item">
      <Link9 />
    </div>
  );
}

function Link10() {
  return (
    <div className="absolute content-stretch flex h-[19px] items-start left-0 top-[2.5px] w-[45.969px]" data-name="Link">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.8)] text-nowrap tracking-[-0.3125px] whitespace-pre">Adaria</p>
    </div>
  );
}

function ListItem3() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="List Item">
      <Link10 />
    </div>
  );
}

function List1() {
  return (
    <div className="content-stretch flex flex-col gap-[12px] h-[60px] items-start relative shrink-0 w-full" data-name="List">
      <ListItem2 />
      <ListItem3 />
    </div>
  );
}

function Container60() {
  return (
    <div className="[grid-area:2_/_1] content-stretch flex flex-col gap-[16px] items-start place-self-stretch relative shrink-0" data-name="Container">
      <Heading8 />
      <List1 />
    </div>
  );
}

function Heading9() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Heading 4">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Resources</p>
    </div>
  );
}

function Link11() {
  return (
    <div className="absolute content-stretch flex h-[19px] items-start left-0 top-[2.5px] w-[100.188px]" data-name="Link">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.8)] text-nowrap tracking-[-0.3125px] whitespace-pre">Privacy Policy</p>
    </div>
  );
}

function ListItem4() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="List Item">
      <Link11 />
    </div>
  );
}

function Link12() {
  return (
    <div className="absolute content-stretch flex h-[19px] items-start left-0 top-[2.5px] w-[121.734px]" data-name="Link">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.8)] text-nowrap tracking-[-0.3125px] whitespace-pre">Terms of Service</p>
    </div>
  );
}

function ListItem5() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="List Item">
      <Link12 />
    </div>
  );
}

function Link13() {
  return (
    <div className="absolute content-stretch flex h-[19px] items-start left-0 top-[2.5px] w-[57.617px]" data-name="Link">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[16px] text-[rgba(255,255,255,0.8)] text-nowrap tracking-[-0.3125px] whitespace-pre">Contact</p>
    </div>
  );
}

function ListItem6() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="List Item">
      <Link13 />
    </div>
  );
}

function List2() {
  return (
    <div className="content-stretch flex flex-col gap-[12px] h-[96px] items-start relative shrink-0 w-full" data-name="List">
      <ListItem4 />
      <ListItem5 />
      <ListItem6 />
    </div>
  );
}

function Container61() {
  return (
    <div className="[grid-area:2_/_2] content-stretch flex flex-col gap-[16px] items-start place-self-stretch relative shrink-0" data-name="Container">
      <Heading9 />
      <List2 />
    </div>
  );
}

function Container62() {
  return (
    <div className="gap-[48px] grid grid-cols-[repeat(2,_minmax(0px,_1fr))] grid-rows-[184px_minmax(0px,_1fr)] h-[368px] relative shrink-0 w-full" data-name="Container">
      <Container58 />
      <Container59 />
      <Container60 />
      <Container61 />
    </div>
  );
}

function Paragraph17() {
  return (
    <div className="h-[24px] relative shrink-0 w-[245.195px]" data-name="Paragraph">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[24px] relative w-[245.195px]">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[16px] text-[rgba(255,255,255,0.7)] top-[-0.5px] tracking-[-0.3125px] w-[246px]">© 2025 Eodin. All rights reserved.</p>
      </div>
    </div>
  );
}

function Paragraph18() {
  return (
    <div className="h-[24px] relative shrink-0 w-[352.102px]" data-name="Paragraph">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[24px] relative w-[352.102px]">
        <p className="absolute font-['Inter:Italic',sans-serif] font-normal italic leading-[24px] left-0 text-[16px] text-[rgba(255,255,255,0.7)] text-nowrap top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Intelligence with wisdom. Technology with heart.</p>
      </div>
    </div>
  );
}

function Container63() {
  return (
    <div className="content-stretch flex h-[24px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Paragraph17 />
      <Paragraph18 />
    </div>
  );
}

function Container64() {
  return (
    <div className="box-border content-stretch flex flex-col h-[57px] items-start pb-0 pt-[33px] px-0 relative shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[1px_0px_0px] border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none" />
      <Container63 />
    </div>
  );
}

function Container65() {
  return (
    <div className="h-[601px] relative shrink-0 w-full" data-name="Container">
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col gap-[48px] h-[601px] items-start pb-0 pt-[64px] px-[24px] relative w-full">
          <Container62 />
          <Container64 />
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="bg-[#ffa569] box-border content-stretch flex flex-col h-[602px] items-start pb-0 pt-px px-0 relative shrink-0 w-full" data-name="Footer">
      <div aria-hidden="true" className="absolute border-[1px_0px_0px] border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none" />
      <Container65 />
    </div>
  );
}

function App() {
  return (
    <div className="absolute bg-[#ffa569] content-stretch flex flex-col h-[6238.38px] items-start left-0 top-0 w-[947px]" data-name="App">
      <Hero4 />
      <About16 />
      <Products4 />
      <Vision9 />
      <Footer />
    </div>
  );
}

function Icon22() {
  return (
    <div className="h-[32px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[1.11%]" data-name="Vector">
        <div className="absolute inset-[-1.14%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
            <path d={svgPaths.p30d97fd0} fill="var(--fill-0, white)" id="Vector" stroke="var(--stroke-0, #FFC095)" strokeWidth="0.711111" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[16.67%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
          <path d={svgPaths.pabd2680} fill="var(--fill-0, #FC8D42)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[28.23%_28.23%_16.67%_16.67%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
          <path d={svgPaths.p14935300} fill="var(--fill-0, #363739)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[28.23%_28.23%_16.67%_16.67%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
          <path d={svgPaths.p1def4e00} fill="var(--fill-0, #FAA668)" id="Vector" />
        </svg>
      </div>
    </div>
  );
}

function Container66() {
  return (
    <div className="relative shrink-0 size-[32px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col items-start relative size-[32px]">
        <Icon22 />
      </div>
    </div>
  );
}

function Icon23() {
  return (
    <div className="h-[30px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[30.34%_2.05%_2.39%_79.64%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 21">
          <path d={svgPaths.p27770a0} fill="var(--fill-0, white)" id="Vector" />
        </svg>
      </div>
      <div className="absolute bottom-[2.39%] left-[68.82%] right-[24.13%] top-0" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7 30">
          <path d={svgPaths.p1a7be400} fill="var(--fill-0, white)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[2.15%_35.12%_0.87%_45.64%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19 30">
          <path d={svgPaths.p93b6a00} fill="var(--fill-0, white)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[30.34%_57.1%_0.87%_22.81%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 21">
          <path d={svgPaths.pb8b9900} fill="var(--fill-0, white)" id="Vector" />
        </svg>
      </div>
      <div className="absolute inset-[6.07%_79.74%_2.39%_1.79%]" data-name="Vector">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19 28">
          <path d={svgPaths.p104cf00} fill="var(--fill-0, white)" id="Vector" />
        </svg>
      </div>
    </div>
  );
}

function Container67() {
  return (
    <div className="basis-0 grow h-[30px] min-h-px min-w-px relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col h-[30px] items-start relative w-full">
        <Icon23 />
      </div>
    </div>
  );
}

function Logo1() {
  return (
    <div className="h-[32px] relative shrink-0 w-[140px]" data-name="Logo">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[10px] h-[32px] items-center relative w-[140px]">
        <Container66 />
        <Container67 />
      </div>
    </div>
  );
}

function Link14() {
  return (
    <div className="h-[24px] relative shrink-0 w-[43.648px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[24px] relative w-[43.648px]">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-0.5px] tracking-[-0.3125px] whitespace-pre">About</p>
      </div>
    </div>
  );
}

function Link15() {
  return (
    <div className="h-[24px] relative shrink-0 w-[65.281px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[24px] relative w-[65.281px]">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Products</p>
      </div>
    </div>
  );
}

function Link16() {
  return (
    <div className="h-[24px] relative shrink-0 w-[43.977px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[24px] relative w-[43.977px]">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-0.5px] tracking-[-0.3125px] whitespace-pre">Vision</p>
      </div>
    </div>
  );
}

function Link17() {
  return (
    <div className="basis-0 bg-white grow h-[48px] min-h-px min-w-px relative rounded-[1.67772e+07px] shrink-0" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[48px] relative w-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-[24px] not-italic text-[#fc8d42] text-[16px] text-nowrap top-[11.5px] tracking-[-0.3125px] whitespace-pre">Contact</p>
      </div>
    </div>
  );
}

function Container68() {
  return (
    <div className="h-[48px] relative shrink-0 w-[402.523px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[48px] h-[48px] items-center relative w-[402.523px]">
        <Link14 />
        <Link15 />
        <Link16 />
        <Link17 />
      </div>
    </div>
  );
}

function Container69() {
  return (
    <div className="content-stretch flex h-[64px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Logo1 />
      <Container68 />
    </div>
  );
}

function Navigation() {
  return (
    <div className="absolute bg-[rgba(255,165,105,0.8)] box-border content-stretch flex flex-col h-[65px] items-start left-0 pb-px pt-0 px-[24px] top-0 w-[947px]" data-name="Navigation">
      <div aria-hidden="true" className="absolute border-[0px_0px_1px] border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none" />
      <Container69 />
    </div>
  );
}

export default function EodinCompanyWebsite() {
  return (
    <div className="bg-white relative size-full" data-name="Eodin Company Website">
      <App />
      <Navigation />
    </div>
  );
}