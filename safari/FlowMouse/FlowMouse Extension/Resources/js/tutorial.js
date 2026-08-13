(function () {
	'use strict';

	const TutorialState = {
		currentStep: 0,
		step1State: 'idle',
		step2Completed: new Set(),
		step3Completed: new Set(),
		gestureActive: false,
		pattern: [],
		stepTransitionCooldown: false,
		step1Cooldown: false
	};

	const CONFIG = {
		DISTANCE_THRESHOLD: 30,
		PATH_LENGTH: 230,
		REQUIRED_DRAG_DISTANCE: 150,
		COOLDOWN_MS: 750
	};

	const isMacOrLinux = /Mac|Linux/i.test(navigator.platform);
	const isMac = /Mac/i.test(navigator.platform);
	let lastRightClickTime = 0;
	const doubleClickDelay = 500;

	const elements = {
		steps: document.querySelectorAll('.step-section'),
		dots: document.querySelectorAll('.progress-dot'),
		tryAgainMessage: document.getElementById('tryAgainMessage'),

		step1Title: document.getElementById('step1Title'),
		step1Subtitle: document.getElementById('step1Subtitle'),
		step1Mouse: document.getElementById('step1Mouse'),
		step1RightBtn: document.getElementById('step1RightBtn'),
		step1Instruction: document.getElementById('step1Instruction'),
		pathFill: document.getElementById('pathFill'),
		progressRect: document.getElementById('progressRect'),
		practiceArea: document.querySelector('.practice-area'),

		cardForward: document.getElementById('cardForward'),
		cardBack: document.getElementById('cardBack'),
		cardUp: document.getElementById('cardUp'),
		cardScroll: document.getElementById('cardScroll'),
		cardClose: document.getElementById('cardClose'),
		discoveryBanner: document.getElementById('discoveryBannerWrapper'),
		itemScrollTop: document.getElementById('itemScrollTop'),
		itemScrollBottom: document.getElementById('itemScrollBottom'),
		itemSwitchLeft: document.getElementById('itemSwitchLeft'),
		itemSwitchRight: document.getElementById('itemSwitchRight'),
		step2ContinueBtn: document.getElementById('step2ContinueBtn'),

		step3Mouse: document.getElementById('step3Mouse'),
		step3LeftBtn: document.getElementById('step3LeftBtn'),
		textDragBox: document.getElementById('textDragBox'),
		linkDragBox: document.getElementById('linkDragBox'),
		selectableText: document.getElementById('selectableText'),
		demoLink: document.getElementById('demoLink'),
		step3DiscoveryWrapper: document.getElementById('step3DiscoveryWrapper'),
		step3SwapContainer: document.querySelector('.step3-swap-container'),
		step3ContinueBtn: document.getElementById('step3ContinueBtn'),

		macLinuxNotice: document.getElementById('macLinuxNotice'),
		macTextDragNotice: document.getElementById('macTextDragNotice'),

		settingsLink: document.getElementById('settingsLink'),
		step4Instruction: document.getElementById('step4Instruction'),
		settingsDragContainer: document.querySelector('.settings-drag-container')
	};

	const visualizer = new window.GestureOverlay();

	const recognizer = new window.GestureRecognizer({
		distanceThreshold: CONFIG.DISTANCE_THRESHOLD
	});

	function arrowsToSvg(text) {
		if (window.GestureConstants && window.GestureConstants.arrowsToSvg) {
			return window.GestureConstants.arrowsToSvg(text);
		}
		return text;
	}

	function msg(key) {
		return window.i18n.getMessage(key);
	}

	function getActionName(actionKey) {
		if (!actionKey) return '';
		const i18nKey = window.GestureConstants?.ACTION_KEYS?.[actionKey];
		if (i18nKey) {
			return msg(i18nKey);
		}
		return actionKey;
	}

	function getHudText(pattern) {
		if (!window.GestureConstants?.DEFAULT_GESTURES) {
			return '';
		}
		const actionKey = window.GestureConstants.DEFAULT_GESTURES[pattern];
		if (actionKey) {
			const actionName = getActionName(actionKey);
			return actionName || actionKey;
		}
		return '';
	}

	function getSuperDragHudText(dragType) {
		if (dragType === 'text') {
			const i18nKey = window.GestureConstants?.TEXT_DRAG_ACTIONS?.['search'];
			return i18nKey ? msg(i18nKey) : 'Search';
		} else if (dragType === 'settings') {
			const actionName = msg('dragActionOpenTabLink');
			return actionName === 'dragActionOpenTabLink' ? 'Open Link' : actionName;
		}
		return '';
	}

	function renderSvgArrows() {
		document.querySelectorAll('.card-icon, .svg-arrow').forEach(el => {
			el.innerHTML = arrowsToSvg(el.textContent.trim());
		});
	}

	function goToStep(stepIndex, instant = false) {
		if (!instant && TutorialState.stepTransitionCooldown) return;

		if (!instant) {
			TutorialState.stepTransitionCooldown = true;
			setTimeout(() => {
				TutorialState.stepTransitionCooldown = false;
			}, 600);
		}

		if (instant) {
			elements.steps.forEach(step => step.style.transition = 'none');
		}

		elements.steps.forEach((step, index) => {
			step.classList.remove('active', 'exit-left', 'exit-right');
			if (index === stepIndex) {
				step.classList.add('active');
			}
		});

		if (instant) {
			void document.body.offsetHeight;
			elements.steps.forEach(step => step.style.transition = '');
		}

		elements.dots.forEach((dot, index) => {
			dot.classList.remove('active', 'completed');
			if (index < stepIndex) {
				dot.classList.add('completed');
			} else if (index === stepIndex) {
				dot.classList.add('active');
			}
		});

		document.body.dataset.activeStep = stepIndex;
		TutorialState.currentStep = stepIndex;
		if (window.history && window.history.replaceState) {
			window.history.replaceState(null, null, '#step' + stepIndex);
		} else {
			window.location.hash = 'step' + stepIndex;
		}

		if (stepIndex === 1) {
			resetStep1();
			TutorialState.step1Cooldown = true;
			setTimeout(() => {
				TutorialState.step1Cooldown = false;
			}, CONFIG.COOLDOWN_MS);
		}

		if (stepIndex === 2) {
			markForwardCompleted();
		}

		if (stepIndex === 3) {
			if (elements.step3LeftBtn) {
				elements.step3LeftBtn.classList.add('pulsing');
			}
			if (elements.selectableText) {
				setTimeout(() => {
					const range = document.createRange();
					range.selectNodeContents(elements.selectableText);
					const selection = window.getSelection();
					selection.removeAllRanges();
					selection.addRange(range);
				}, 100);
			}

			if (isMac && elements.macTextDragNotice) {
				elements.macTextDragNotice.style.display = 'block';
			}
		}

		if (stepIndex === 4) {
			if (window.Confetti) {
				setTimeout(() => {
					window.Confetti.startShower(4000);
				}, 300);
			}
		} else {
			if (window.Confetti) {
				window.Confetti.stop();
			}
		}
	}

	function markForwardCompleted() {
		TutorialState.step2Completed.add('forward');
		if (elements.cardForward) {
			elements.cardForward.classList.add('completed', 'success-pulse');
			const status = elements.cardForward.querySelector('.card-status');
			if (status) {
				status.setAttribute('data-i18n', 'tutorialCompleted');
				const completedMsg = msg('tutorialCompleted');
				status.textContent = (completedMsg && completedMsg !== 'tutorialCompleted') ? completedMsg : 'Done';
			}
		}
		updateStep2Progress();
	}

	function resetStep1() {
		TutorialState.step1State = 'idle';
		TutorialState.gestureActive = false;
		TutorialState.pattern = [];

		elements.step1RightBtn.classList.remove('pressed');
		if (elements.progressRect) elements.progressRect.setAttribute('width', '0');
		elements.practiceArea.classList.remove('visible');

		updateStep1Instruction('idle');
	}

	function updateStep1Instruction(state) {
		const rightArrow = arrowsToSvg('→');
		const instructions = {
			idle: msg('tutorialStep1InstructionIdle'),
			pressing: msg('tutorialStep1InstructionPressing').replace('%arrow%', rightArrow),
			dragging: msg('tutorialStep1InstructionDragging'),
			releasing: msg('tutorialStep1InstructionReleasing')
		};

		elements.step1Instruction.innerHTML = instructions[state] || instructions.idle;
	}

	function showMessage(text) {
		elements.tryAgainMessage.innerHTML = text;
		elements.tryAgainMessage.classList.add('show');
		setTimeout(() => {
			elements.tryAgainMessage.classList.remove('show');
		}, 2000);
	}

	function updateStep2Progress() {
		const count = TutorialState.step2Completed.size;

		if (count >= 5) {
			if (elements.step2ContinueBtn) {
				elements.step2ContinueBtn.style.visibility = 'visible';
				elements.step2ContinueBtn.style.opacity = '1';

				{
					if (isMacOrLinux && elements.macLinuxNotice) {
						elements.macLinuxNotice.style.display = 'block';
						try { chrome.storage.sync.set({ macLinuxHintDismissed: true }); } catch (e) {}
					}
				}
			}
			if (elements.discoveryBanner) {
				elements.discoveryBanner.classList.add('visible');
			}
		}
	}

	function animatePage(direction) {
		const classMap = {
			'left': 'animate-left',
			'right': 'animate-right',
			'up': 'animate-up',
			'down': 'animate-down',
			'up-big': 'animate-up-big',
			'down-big': 'animate-down-big'
		};

		const animClass = classMap[direction];
		if (animClass) {
			document.body.classList.add(animClass);
			setTimeout(() => {
				document.body.classList.remove(animClass);
			}, 600);
		}
	}

	function animatePageExit() {
		document.body.classList.add('animate-exit');
		setTimeout(() => {
			document.body.classList.remove('animate-exit');
			document.body.classList.add('animate-enter');
			setTimeout(() => {
				document.body.classList.remove('animate-enter');
			}, 400);
		}, 300);
	}

	document.addEventListener('contextmenu', (e) => {
		if (TutorialState.currentStep === 1 ||
			TutorialState.currentStep === 3 ||
			(TutorialState.currentStep === 2 && TutorialState.step2Completed.size < 5)) {
			e.preventDefault();
			e.stopPropagation();
			return false;
		}

		if (isMacOrLinux) {
			if (e.ctrlKey || e.button !== 2) return;

			const now = Date.now();

			if (TutorialState.preventContextMenu) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}

			if (now - lastRightClickTime < doubleClickDelay) {
				lastRightClickTime = 0;
				recognizer.reset();
				TutorialState.gestureActive = false;
				return;
			} else {
				lastRightClickTime = now;
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
		} else {
			if (TutorialState.preventContextMenu) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
		}
	}, true);

	document.addEventListener('pointerdown', (e) => {
		if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && e.button === 2) {

			if (TutorialState.currentStep === 0) {
				goToStep(1);
				TutorialState.preventContextMenu = true;
			}

			const isStep3Incomplete = TutorialState.currentStep === 3 && !TutorialState.step3Completed.has('text');
			const isStep4Incomplete = TutorialState.currentStep === 4 && elements.settingsDragContainer && !elements.settingsDragContainer.classList.contains('completed');

			if (isStep3Incomplete || isStep4Incomplete) {
				showMessage(msg('tutorialDragWrongButton'));
				return;
			}

			if (TutorialState.currentStep >= 1) {
				TutorialState.gestureActive = true;
				TutorialState.preventContextMenu = false;
				recognizer.start(e.clientX, e.clientY);
				TutorialState.pattern = [];

				try {
					e.target.setPointerCapture(e.pointerId);
				} catch (err) { }

				if (TutorialState.currentStep === 1) {
					TutorialState.step1State = 'pressing';
					elements.step1RightBtn.classList.add('pressed');
					elements.practiceArea.classList.add('visible');
					updateStep1Instruction('pressing');
				}
			}
		}
	}, true);

	let edgeGestureDetected = false;

	window.addEventListener('blur', () => {
		if (TutorialState.gestureActive) {
			visualizer.hide();
			recognizer.reset();
			TutorialState.gestureActive = false;
			TutorialState.pattern = [];
			TutorialState.preventContextMenu = false;

			if (TutorialState.currentStep === 1) {
				resetStep1();
				if (window.i18n.isEdgeDesktop) {
					edgeGestureDetected = true;
				}
			}
		}
	});

	if (window.i18n.isEdgeDesktop) {
		window.addEventListener('focus', () => {
			if (edgeGestureDetected) {
				edgeGestureDetected = false;
				TutorialState.stepTransitionCooldown = false;
				goToStep(3);
			}
		});
	}

	document.addEventListener('pointermove', (e) => {
		if (!TutorialState.gestureActive) return;

		const result = recognizer.move(e.clientX, e.clientY);

		if (result.activated) {
			TutorialState.preventContextMenu = true;
			visualizer.show();
			visualizer.addPoint(recognizer.startX, recognizer.startY);
		}

		if (!recognizer.isActive()) return;

		if (e.getCoalescedEvents) {
			const events = e.getCoalescedEvents();
			if (events.length > 0) {
				const points = events.map(evt => ({ x: evt.clientX, y: evt.clientY }));
				visualizer.addPoints(points);
			} else {
				visualizer.addPoint(e.clientX, e.clientY);
			}
		} else {
			visualizer.addPoint(e.clientX, e.clientY);
		}

		if (TutorialState.currentStep === 1) {
			const totalDeltaX = e.clientX - recognizer.startX;
			if (totalDeltaX > 0) {
				const progress = Math.min(totalDeltaX / CONFIG.REQUIRED_DRAG_DISTANCE, 1);
				if (elements.progressRect) {
					elements.progressRect.setAttribute('width', progress * 270);
				}

				if (progress > 0.3) {
					TutorialState.step1State = 'dragging';
					updateStep1Instruction('dragging');
				}

				if (progress >= 1) {
					TutorialState.step1State = 'releasing';
					updateStep1Instruction('releasing');
				}
			}
		}

		if (result.directionChanged) {
			TutorialState.pattern.push(result.direction);

			const patternStr = TutorialState.pattern.join('');
			const hudText = getHudText(patternStr);
			visualizer.updateAction(patternStr, hudText ? [hudText] : []);
		}
	}, true);

	document.addEventListener('pointerup', (e) => {
		if (e.button !== 2) return;
		if (!TutorialState.gestureActive) return;

		if (recognizer.isActive()) {
			e.preventDefault();
			e.stopPropagation();
			lastRightClickTime = 0;
		}

		visualizer.hide();

		const pattern = TutorialState.pattern.join('');

		if (TutorialState.currentStep === 1) {
			if (TutorialState.step1State === 'releasing' && pattern === '→') {
				elements.step1RightBtn.classList.remove('pressed');
				TutorialState.stepTransitionCooldown = false;
				goToStep(2);
			} else {
				if (TutorialState.step1State !== 'idle' && recognizer.isActive()) {
					if (pattern && pattern !== '→') {
						showMessage(msg('tutorialWrongDirection').replace('%arrow%', arrowsToSvg('→')));
					} else if (TutorialState.step1State === 'pressing' || TutorialState.step1State === 'dragging') {
						showMessage(msg('tutorialEarlyRelease'));
					}
				}

				resetStep1();
			}
		}

		if (TutorialState.currentStep >= 2 && pattern) {
			handleGestureAction(pattern);
		}

		TutorialState.gestureActive = false;
		TutorialState.pattern = [];
		recognizer.reset();

		if (TutorialState.currentStep === 1) {
			elements.step1RightBtn.classList.remove('pressed');
		}

		setTimeout(() => {
			TutorialState.preventContextMenu = false;
		}, 100);
	}, true);

	function handleGestureAction(pattern) {
		let card = null;
		let animDirection = null;
		let gestureKey = null;

		if (pattern === '←') {
			card = elements.cardBack;
			animDirection = 'right';
			gestureKey = 'back';
		} else if (pattern === '→') {
			card = elements.cardForward;
			animDirection = 'left';
			gestureKey = 'forward';
		} else if (pattern === '↑') {
			card = elements.cardUp;
			animDirection = 'down';
			gestureKey = 'up';
		} else if (pattern === '↓') {
			card = elements.cardScroll;
			animDirection = 'up';
			gestureKey = 'scroll';
		} else if (pattern === '↓→') {
			card = elements.cardClose;
			animDirection = null;
			gestureKey = 'close';
		} else if (pattern === '→↑') {
			card = elements.itemNewTab;
			animDirection = 'exit';
			gestureKey = 'newTab';
		} else if (pattern === '→↓') {
			card = elements.itemRefresh;
			animDirection = 'exit';
			gestureKey = 'refresh';
		} else if (pattern === '↓↑') {
			card = elements.itemScrollTop;
			animDirection = 'down-big';
			gestureKey = 'scrollToTop';
		} else if (pattern === '↑↓') {
			card = elements.itemScrollBottom;
			animDirection = 'up-big';
			gestureKey = 'scrollToBottom';
		} else if (pattern === '↑←') {
			card = elements.itemSwitchLeft;
			animDirection = 'right';
			gestureKey = 'switchLeft';
		} else if (pattern === '↑→') {
			card = elements.itemSwitchRight;
			animDirection = 'left';
			gestureKey = 'switchRight';
		}

		if (animDirection === 'exit') {
			animatePageExit();
		} else if (animDirection) {
			animatePage(animDirection);
		} else if (pattern === '↓→') {
			animatePageExit();
		}

		if (TutorialState.currentStep === 2) {
			if (card && !card.classList.contains('completed') && gestureKey) {
				TutorialState.step2Completed.add(gestureKey);
				card.classList.add('completed', 'success-pulse');

				const status = card.querySelector('.card-status');
				if (status) {
					status.setAttribute('data-i18n', 'tutorialCompleted');
					const completedMsg = msg('tutorialCompleted');
					status.textContent = (completedMsg && completedMsg !== 'tutorialCompleted') ? completedMsg : 'Done';
				}
			}

			updateStep2Progress();
		}
	}

	let isDragging = false;
	let dragType = null;
	const dragRecognizer = new window.GestureRecognizer({
		distanceThreshold: CONFIG.DISTANCE_THRESHOLD
	});

	function startDrag(type, x, y) {
		isDragging = true;
		dragType = type;
		dragRecognizer.start(x, y);
	}

	document.addEventListener('dragstart', (e) => {
		if (TutorialState.currentStep === 3) {
			const selection = window.getSelection();
			if (selection.toString().trim()) {
				startDrag('text', e.clientX, e.clientY);

				if (elements.step3LeftBtn) {
					elements.step3LeftBtn.classList.remove('pulsing');
					elements.step3LeftBtn.classList.add('pressed');
				}
			}
			return;
		}

		if (TutorialState.currentStep === 4) {
			const target = e.target;
			if (target.id === 'settingsLink' || target.closest('#settingsLink')) {
				startDrag('settings', e.clientX, e.clientY);
			}
		}
	});

	document.addEventListener('dragover', (e) => {
		if (isDragging) {

			const result = dragRecognizer.move(e.clientX, e.clientY);

			if (result.activated) {
				visualizer.show();
				visualizer.addPoint(dragRecognizer.startX, dragRecognizer.startY);
			}

			if (!dragRecognizer.isActive()) return;

			e.preventDefault();

			visualizer.addPoint(e.clientX, e.clientY);

			if (result.directionChanged) {
				const pattern = dragRecognizer.getPattern();
				if (pattern === '→') {
					const dragHudText = getSuperDragHudText(dragType);
					visualizer.updateAction('→', dragHudText ? [dragHudText] : []);
				} else {
					visualizer.updateAction('', []);
				}
			}
		}
	});

	document.addEventListener('dragleave', (e) => {
		if (isDragging && e.relatedTarget === null) {
			resetDragState();
		}
	}, true);

	document.addEventListener('drop', (e) => {
		if (isDragging && dragRecognizer.isActive()) {
			e.preventDefault();
			handleDragComplete(e);
		}
		resetDragState();
	});

	document.addEventListener('dragend', (e) => {
		handleDragComplete(e);
		resetDragState();
	});


	function handleDragComplete(e) {
		if (!isDragging) return;

		const pattern = dragRecognizer.getPattern();
		const startX = dragRecognizer.startX;
		const dragDistance = e.clientX - startX;
		const isRightDrag = pattern === '→' && dragDistance > CONFIG.REQUIRED_DRAG_DISTANCE / 2;

		if (TutorialState.currentStep === 3 && dragType === 'text' && isRightDrag) {
			elements.textDragBox.classList.add('completed', 'success-pulse');
			TutorialState.step3Completed.add('text');

			setTimeout(() => {
				if (elements.step3SwapContainer) {
					elements.step3SwapContainer.classList.add('show-discovery');
				}
				if (elements.step3ContinueBtn) {
					elements.step3ContinueBtn.style.visibility = 'visible';
					elements.step3ContinueBtn.style.opacity = '1';
				}
			}, 600);
		}

		if (TutorialState.currentStep === 4 && dragType === 'settings' && isRightDrag) {
			if (!elements.settingsDragContainer.classList.contains('completed')) {
				elements.settingsDragContainer.classList.add('completed', 'success-pulse');
				setTimeout(() => {
					chrome.runtime.openOptionsPage();
				}, 400);
			} else {
				chrome.runtime.openOptionsPage();
			}
		}
	}

	function resetDragState() {
		if (!isDragging) return;

		visualizer.hide();
		isDragging = false;
		dragRecognizer.reset();

		if (elements.step3LeftBtn) {
			elements.step3LeftBtn.classList.remove('pressed');
			if (TutorialState.step3Completed.size === 0) {
				elements.step3LeftBtn.classList.add('pulsing');
			}
		}
	}

	if (elements.step2ContinueBtn) {
		elements.step2ContinueBtn.addEventListener('click', () => {
			goToStep(3);
		});
	}

	if (elements.step3ContinueBtn) {
		elements.step3ContinueBtn.addEventListener('click', () => {
			goToStep(4);
		});
	}

	if (elements.settingsLink) {
		elements.settingsLink.addEventListener('click', (e) => {
			e.preventDefault();

			if (elements.step4Instruction) {
				elements.step4Instruction.classList.remove('highlight-pulse');
				void elements.step4Instruction.offsetWidth;
				elements.step4Instruction.classList.add('highlight-pulse');
			}
		});
	}

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			if (TutorialState.gestureActive) {
				visualizer.hide();
				TutorialState.gestureActive = false;
				TutorialState.pattern = [];

				if (TutorialState.currentStep === 1) {
					resetStep1();
				}
			}
		}
	});

	function init() {
		renderSvgArrows();

		visualizer.updateSettings({
			lang: window.i18n.getHtmlLang(),
			isRtl: window.i18n.getDir() === 'rtl',
		});

		if (elements.progressRect) elements.progressRect.setAttribute('width', '0');

		window.addEventListener('hashchange', () => {
			const hash = window.location.hash;
			if (hash && hash.startsWith('#step')) {
				const stepIndex = parseInt(hash.replace('#step', ''), 10);
				if (!isNaN(stepIndex) && stepIndex >= 0 && stepIndex <= 4) {
					if (stepIndex !== TutorialState.currentStep) {
						goToStep(stepIndex);
					}
				}
			}
		});

		const hash = window.location.hash;
		if (hash && hash.startsWith('#step')) {
			const stepIndex = parseInt(hash.replace('#step', ''), 10);
			if (!isNaN(stepIndex) && stepIndex >= 0 && stepIndex <= 4) {
				goToStep(stepIndex, true);
			}
		}

		chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
			if (request.action === 'ping') {
				sendResponse({ pong: true });
				return;
			}
		});
	}

	window.i18n.waitForInit().then(init);
})();