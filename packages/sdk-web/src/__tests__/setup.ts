// jsdom 이 localStorage / fetch / crypto / navigator 모두 제공.
// 본 setup 파일은 setupFiles 로 로드되어 jest 프레임워크 로딩 전 실행되므로
// beforeEach() 등 jest globals 는 사용할 수 없다. 각 테스트 파일이
// `beforeEach(() => localStorage.clear())` 를 직접 호출해 isolation 보장.
//
// fetch 는 의도적으로 stub 하지 않음 — 각 테스트가 jest.fn() 으로 mock.

export {};
