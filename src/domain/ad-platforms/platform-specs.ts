// 네이버, 구글, 카카오 광고 플랫폼별 텍스트 규격
// ⚠️ 주의: 이것은 선택적 옵션입니다!
// 사용자가 [광고매체] 옵션에서 특정 플랫폼을 선택했을 때만 적용됩니다
// 선택하지 않으면 일반 카피 생성 (메인 시스템)

export interface PlatformTextSpec {
  platform: "naver" | "google" | "kakao";
  adType: string;
  textSpecs: {
    title: {
      minChars: number;
      maxChars: number;
      note: string;
    };
    description: {
      minChars: number;
      maxChars: number;
      note: string;
    };
  };
  prohibitedWords: string[]; // 완전 금지 단어/문구
  restrictedWords: string[]; // 제한적 허용 (증빙 필요 등)
  prohibitedExpressions: string[]; // 금지 표현 유형
  recommendations: string[];
}

/**
 * 네이버 광고 텍스트 규격
 * 출처: 네이버 광고센터 공식 가이드
 */
export const NAVER_TEXT_SPECS: PlatformTextSpec[] = [
  {
    platform: "naver",
    adType: "파워링크 (검색 광고)",
    textSpecs: {
      title: {
        minChars: 1,
        maxChars: 15,
        note: "브랜드검색 소재는 통상 15~20자 이내",
      },
      description: {
        minChars: 1,
        maxChars: 45,
        note: "설명문 40~120자 내외 (유형별 상이)",
      },
    },
    prohibitedWords: [
      "최저가", "단독할인", "100%혜택", "인생템", 
      "No.1", "최고", "최상", "완벽", "빠른상담"
    ],
    restrictedWords: [
      "할인", "이벤트", "특가", "세일", // 제한적 허용
      "클릭", "지금", "당장" // 유도어, 제한적 허용
    ],
    prohibitedExpressions: [
      "허위·과장 표현",
      "선정적 표현",
      "비교·비방 문구",
      "이벤트성 문구",
      "법률 위반 문구",
      "오해 소지 문구",
      "비속어"
    ],
    recommendations: [
      "정보성 텍스트만 사용",
      "제품/서비스 핵심 정보 중심",
      "간결하고 명확하게",
      "브랜드명, 제품명 강조",
    ],
  },
  {
    platform: "naver",
    adType: "브랜드검색",
    textSpecs: {
      title: {
        minChars: 1,
        maxChars: 20,
        note: "브랜드명 중심, 간결",
      },
      description: {
        minChars: 1,
        maxChars: 50,
        note: "핵심 메시지만",
      },
    },
    prohibitedWords: [
      "최고", "1위", "완벽", "혁신" // 증빙 없는 최상급
    ],
    restrictedWords: [],
    prohibitedExpressions: [
      "과장 표현",
      "이벤트 문구 (지양)",
    ],
    recommendations: [
      "브랜드 핵심 가치",
      "차별화 포인트",
      "신뢰성 강조",
    ],
  },
  {
    platform: "naver",
    adType: "쇼핑검색",
    textSpecs: {
      title: {
        minChars: 1,
        maxChars: 30,
        note: "상품명 중심",
      },
      description: {
        minChars: 1,
        maxChars: 100,
        note: "상품 상세 설명",
      },
    },
    prohibitedWords: [
      "최저가", "대박", "인생템"
    ],
    restrictedWords: [],
    prohibitedExpressions: [
      "할인/이벤트 문구 (이미지에 표기 금지)",
      "과장 표현",
    ],
    recommendations: [
      "상품 핵심 특징",
      "차별화 요소",
      "정보성 중심",
    ],
  },
];

/**
 * 구글 광고 텍스트 규격
 * 출처: 구글 광고 공식 가이드
 */
export const GOOGLE_TEXT_SPECS: PlatformTextSpec[] = [
  {
    platform: "google",
    adType: "검색 광고",
    textSpecs: {
      title: {
        minChars: 1,
        maxChars: 30,
        note: "한글 기준 약 30자 (영문 기준이므로 실제는 더 짧음), 최대 15개 등록 가능",
      },
      description: {
        minChars: 1,
        maxChars: 90,
        note: "한글 기준 약 90자 (영문 기준이므로 실제는 더 짧음), 최대 4개 등록 가능",
      },
    },
    prohibitedWords: [
      "No.1", "1위", "최저가", "무료", "99% 할인",
      "클릭", "상담", "전화번호", "URL"
    ],
    restrictedWords: [
      "최고", "혁신", "완벽" // 증빙 필요
    ],
    prohibitedExpressions: [
      "과장·허위·비방 표현",
      "필수 정보 누락",
      "오해의 소지",
      "이벤트성 강조 문구",
      "직접 유도 텍스트",
    ],
    recommendations: [
      "명확하고 사실적으로",
      "구체적 혜택 제시",
      "브랜드/제품명 강조",
      "국가 언어 일치 필수",
    ],
  },
  {
    platform: "google",
    adType: "디스플레이 광고",
    textSpecs: {
      title: {
        minChars: 1,
        maxChars: 30,
        note: "간결하고 핵심만",
      },
      description: {
        minChars: 1,
        maxChars: 90,
        note: "정보 중심, 텍스트 최소화",
      },
    },
    prohibitedWords: [
      "최저가", "무료", "대박"
    ],
    restrictedWords: [],
    prohibitedExpressions: [
      "이미지 내 텍스트 20% 초과",
      "과장/유도어",
    ],
    recommendations: [
      "시각적 요소 우선",
      "텍스트는 보조 역할",
      "고해상도 이미지",
    ],
  },
  {
    platform: "google",
    adType: "반응형 광고",
    textSpecs: {
      title: {
        minChars: 1,
        maxChars: 30,
        note: "다양한 조합 가능하도록 독립적 의미",
      },
      description: {
        minChars: 1,
        maxChars: 90,
        note: "각 설명이 독립적으로 의미 전달",
      },
    },
    prohibitedWords: [],
    restrictedWords: [],
    prohibitedExpressions: [
      "맥락 의존적 표현 (다른 요소 없이는 의미 불명확)",
    ],
    recommendations: [
      "각 요소 독립적 의미",
      "조합 가능성 고려",
      "여러 버전 제공",
      "A/B 테스트 용이하게",
    ],
  },
];

/**
 * 카카오 광고 텍스트 규격
 * 출처: 카카오 광고센터 공식 가이드
 */
export const KAKAO_TEXT_SPECS: PlatformTextSpec[] = [
  {
    platform: "kakao",
    adType: "비즈보드",
    textSpecs: {
      title: {
        minChars: 1,
        maxChars: 20,
        note: "간결하고 명확, 정보성만",
      },
      description: {
        minChars: 1,
        maxChars: 40,
        note: "심플하게, 핵심만",
      },
    },
    prohibitedWords: [
      "최고", "단독", "1위", "초특가", "마감임박", "대박혜택",
      "클릭", "지금신청", "무료", "할인", "이벤트"
    ],
    restrictedWords: [
      "신제품 출시" // 정보성은 허용
    ],
    prohibitedExpressions: [
      "이미지 내 텍스트/이벤트 금지",
      "가격·할인·혜택 문구",
      "유도어·비속어",
      "비교·비방",
      "허위·과장",
      "선정적·폭력적 표현",
      "최상급 표현 (증빙 없으면)",
      "비속어, 은어, 무리한 축약어",
      "띄어쓰기 오류",
      "특수문자, 기호 남용",
    ],
    recommendations: [
      "간결하고 명확",
      "제품/서비스 핵심 정보만",
      "심플 디자인",
      "정보성 중심",
    ],
  },
  {
    platform: "kakao",
    adType: "네이티브",
    textSpecs: {
      title: {
        minChars: 1,
        maxChars: 25,
        note: "정보성 중심",
      },
      description: {
        minChars: 1,
        maxChars: 50,
        note: "실물 상품/서비스 설명",
      },
    },
    prohibitedWords: [
      "최저가", "무조건", "100%", "대박"
    ],
    restrictedWords: [],
    prohibitedExpressions: [
      "이미지 내 이벤트/가격 텍스트",
      "과장 표현",
    ],
    recommendations: [
      "실제 상품 이미지 중심",
      "디자인 여백 확보",
      "고화질",
      "폰트 가독성",
    ],
  },
];

/**
 * 플랫폼별 규격 조회
 */
export function getPlatformTextSpec(
  platform: "naver" | "google" | "kakao",
  adType?: string
): PlatformTextSpec | undefined {
  const specsMap = {
    naver: NAVER_TEXT_SPECS,
    google: GOOGLE_TEXT_SPECS,
    kakao: KAKAO_TEXT_SPECS,
  };

  const specs = specsMap[platform];
  if (!specs) return undefined;

  if (!adType) {
    return specs[0]; // 기본값: 첫 번째 (가장 일반적)
  }

  return specs.find((spec) =>
    spec.adType.toLowerCase().includes(adType.toLowerCase())
  );
}

/**
 * 플랫폼 규격을 프롬프트에 추가할 문자열로 변환
 * 선택적 옵션으로만 사용
 */
export function buildPlatformCompliancePrompt(
  platform: "naver" | "google" | "kakao",
  adType?: string
): string {
  const spec = getPlatformTextSpec(platform, adType);
  if (!spec) {
    return ""; // 규격 없으면 빈 문자열 (메인 시스템만 작동)
  }

  return `
## ⚠️ ${spec.platform.toUpperCase()} 광고 플랫폼 규격 준수 필수

사용자가 ${spec.platform} 광고매체를 선택했습니다.
다음 규격을 **반드시** 준수하여 카피를 작성하세요:

### 텍스트 글자수 제한
- 제목(Title): ${spec.textSpecs.title.minChars}~${spec.textSpecs.title.maxChars}자
  ${spec.textSpecs.title.note}
  
- 설명(Description): ${spec.textSpecs.description.minChars}~${spec.textSpecs.description.maxChars}자
  ${spec.textSpecs.description.note}

### 🚫 절대 사용 금지 문구
다음 단어/표현은 절대 사용하지 마세요 (심사 거절됨):
${spec.prohibitedWords.map(w => `- "${w}"`).join("\n")}

### ⚠️ 금지 표현 유형
${spec.prohibitedExpressions.map(e => `- ${e}`).join("\n")}

${spec.restrictedWords.length > 0 ? `
### ⚡ 제한적 허용 (신중하게 사용)
다음은 제한적으로만 허용됩니다:
${spec.restrictedWords.map(w => `- "${w}"`).join("\n")}
` : ""}

### ✅ 권장 사항
${spec.recommendations.map(r => `- ${r}`).join("\n")}

**중요**: 위 규격을 지키지 않으면 광고 심사에서 거절되거나 노출이 제한됩니다.
반드시 준수하여 작성하세요!
`.trim();
}

/**
 * 생성된 카피가 플랫폼 규격을 준수하는지 검증
 */
export function validatePlatformCompliance(
  copy: string,
  platform: "naver" | "google" | "kakao",
  type: "title" | "description" = "title"
): {
  isCompliant: boolean;
  charCount: number;
  maxChars: number;
  violations: string[];
  warnings: string[];
} {
  const spec = getPlatformTextSpec(platform);
  if (!spec) {
    return {
      isCompliant: true,
      charCount: copy.length,
      maxChars: 100,
      violations: [],
      warnings: [],
    };
  }

  const textSpec = spec.textSpecs[type];
  const charCount = copy.length;
  const violations: string[] = [];
  const warnings: string[] = [];

  // 1. 글자수 검증
  if (charCount > textSpec.maxChars) {
    violations.push(
      `글자수 초과: ${charCount}자 > ${textSpec.maxChars}자 (${platform} ${type} 규격)`
    );
  }
  if (charCount < textSpec.minChars) {
    violations.push(
      `글자수 부족: ${charCount}자 < ${textSpec.minChars}자`
    );
  }

  // 2. 금지 단어 검증
  for (const prohibited of spec.prohibitedWords) {
    if (copy.includes(prohibited)) {
      violations.push(
        `금지 단어 포함: "${prohibited}" (${platform} 심사 거절 사유)`
      );
    }
  }

  // 3. 제한적 허용 단어 경고
  for (const restricted of spec.restrictedWords) {
    if (copy.includes(restricted)) {
      warnings.push(
        `제한적 허용 단어: "${restricted}" (증빙 또는 조건부 허용)`
      );
    }
  }

  // 4. 금지 표현 패턴 검증
  const prohibitedPatterns: Record<string, RegExp> = {
    "최상급 (증빙 없음)": /최고|최상|1위|No\.?1|넘버원/,
    "과장 표현": /완벽|혁신|기적|놀라운|대박/,
    "이벤트 문구": /할인|이벤트|특가|세일|프로모션/,
    "유도어": /클릭|당장|지금|바로|신청|상담/,
  };

  for (const [expressionType, pattern] of Object.entries(prohibitedPatterns)) {
    if (pattern.test(copy)) {
      // 플랫폼별로 엄격도 다름
      if (platform === "kakao" || platform === "naver") {
        if (expressionType.includes("최상급") || expressionType.includes("과장")) {
          violations.push(`${expressionType} 포함 (${platform} 거절 가능)`);
        } else {
          warnings.push(`${expressionType} 포함 (제한적 허용)`);
        }
      } else {
        warnings.push(`${expressionType} 포함 (신중히 사용)`);
      }
    }
  }

  return {
    isCompliant: violations.length === 0,
    charCount,
    maxChars: textSpec.maxChars,
    violations,
    warnings,
  };
}

/**
 * 모든 플랫폼 규격 목록
 */
export function getAllPlatformSpecs(): PlatformTextSpec[] {
  return [
    ...NAVER_TEXT_SPECS,
    ...GOOGLE_TEXT_SPECS,
    ...KAKAO_TEXT_SPECS,
  ];
}
