// animations.js — Completion & transition animations

export function playCompleteAnimation(element) {
  if (!element) return;

  // Add burst particles
  const rect = element.getBoundingClientRect();
  const burst = document.createElement('div');
  burst.className = 'completion-burst';
  burst.style.left = rect.left + rect.width / 2 + 'px';
  burst.style.top = rect.top + rect.height / 2 + 'px';

  // Create particles
  for (let i = 0; i < 8; i++) {
    const particle = document.createElement('div');
    particle.className = 'burst-particle';
    const angle = (i / 8) * 360;
    const distance = 20 + Math.random() * 15;
    particle.style.setProperty('--angle', angle + 'deg');
    particle.style.setProperty('--distance', distance + 'px');
    burst.appendChild(particle);
  }

  document.body.appendChild(burst);

  // Flash effect on the item
  element.classList.add('completing');

  setTimeout(() => {
    element.classList.remove('completing');
    if (burst.parentNode) burst.parentNode.removeChild(burst);
  }, 600);
}

export function animateColumnSlideIn(columnElement) {
  columnElement.classList.add('column-slide-in');
  requestAnimationFrame(() => {
    columnElement.classList.remove('column-slide-in');
  });
}
