(() => {
	window.__probe = null;
	const tick = () => {
		if (document.querySelector(".expr-line")) {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					window.__probe = Math.round(performance.now());
				});
			});
			return;
		}
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
})();
