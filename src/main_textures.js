"use strict";
const {mat2, mat4, mat3, vec4, vec3, vec2} = glMatrix;
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment

const deg_to_rad = Math.PI / 180;

async function main() {
	/* const in JS means the variable will not be bound to a new value, but the value can be modified (if its an object or array)
		https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
	*/

	// We are using the REGL library to work with webGL
	// http://regl.party/api
	// https://github.com/regl-project/regl/blob/master/API.md

	// The <canvas> (HTML element for drawing graphics) was created by REGL, lets take a handle to it.
	const canvas_elem = document.getElementsByTagName('canvas')[0];

	const regl = createREGL({ // the canvas to use
		canvas: canvas_elem,
		profile: true, // if we want to measure the size of buffers/textures in memory
		extensions: ['oes_texture_float'], // float textures
	});

	

	let update_needed = true;

	{
		// Resize canvas to fit the window, but keep it square.
		function resize_canvas() {
			const s = Math.min(window.innerHeight, window.innerWidth) - 10;
			canvas_elem.width = s;
			canvas_elem.height = s;

			update_needed = true;
		}
		resize_canvas();
		window.addEventListener('resize', resize_canvas);
	}

	const debug_overlay = document.getElementById('debug-overlay');
	const debug_text = document.getElementById('debug-text');

	/*---------------------------------------------------------------
		Resource loading
	---------------------------------------------------------------*/

	/*
	The textures fail to load when the site is opened from local file (file://) due to "cross-origin".
	Solutions:
	* run a local webserver
		python -m http.server 8000
		# open localhost:8000
	OR
	* run chromium with CLI flag
		"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --allow-file-access-from-files index.html

	* edit config in firefox
		security.fileuri.strict_origin_policy = false
	*/

	// Start downloads in parallel
	const resources = {};

	[
		"noise.frag",
		"display.vert",

		"buffer_to_screen.vert",
		"buffer_to_screen.frag",

	].forEach((shader_filename) => {
		resources[`shaders/${shader_filename}`] = load_text(`./src/shaders/${shader_filename}`);
	});

	// Wait for all downloads to complete
	for (const key in resources) {
		if (resources.hasOwnProperty(key)) {
			resources[key] = await resources[key]
		}
	}

	/*---------------------------------------------------------------
		Drag with mouse
	---------------------------------------------------------------*/

	let zoom_factor = 1.0;
	const ZOOM_MIN = 0.1;
	const ZOOM_MAX = 10.0;

	window.addEventListener('wheel', (event) => {
		// scroll wheel to zoom in or out
		const factor_mul_base = 1.08;
		const factor_mul = (event.deltaY > 0) ? factor_mul_base : 1./factor_mul_base;
		zoom_factor *= factor_mul;
		zoom_factor = Math.max(ZOOM_MIN, Math.min(zoom_factor, ZOOM_MAX));
		event.preventDefault(); // don't scroll the page too...
		//update_cam_transform();
		
		update_needed = true;
	})

	/* `const` in JS means the variable will not be bound to a new value, but the value can be modified (if its an object or array)
		https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
		Here we keep the same array but change the numerical values inside.
	*/
	const mouse_offset = [0, 0];

	// Prevent clicking and dragging from selecting the GUI text.
	canvas_elem.addEventListener('mousedown', (event) => { event.preventDefault(); });

	// Register the functions to be executed when the mouse moves
	window.addEventListener('mousemove', (event) => {
		// if left or middle button is pressed
		if (event.buttons & 1 || event.buttons & 4) {
			// The GPU coordinate frame is from bottom left [-1, -1] to top right [1, 1].
			// therefore the scale from pixels to canvas is  2 / [width, height] and we have to invert Y because pixel offsets are counted from the top-left corner.
			mouse_offset[0] +=  2 * event.movementX / canvas_elem.clientWidth  * zoom_factor;
			mouse_offset[1] += -2 * event.movementY / canvas_elem.clientHeight * zoom_factor;

			update_needed = true;
		}
	});


	/*---------------------------------------------------------------
		Noise
	---------------------------------------------------------------*/

	const noise_textures = init_noise(regl, resources);

	/*
		UI
	*/

	// Select texture to show
	let selected_tex = noise_textures[0];

	const elem_variant_select = document.getElementById('variants');

	noise_textures.forEach((ntex, idx) => {
		const handler = () => {
			selected_tex = ntex;
			update_needed = true;

			console.log(`Selected texture: ${ntex.name}`);
		}

		const key = (idx+1).toString();
		register_keyboard_action(key, handler);

		if(!ntex.hidden) {
			const entry = document.createElement('li');
			entry.classList.add('button');
			entry.textContent = ntex.name;
			entry.addEventListener('click', handler);
			elem_variant_select.appendChild(entry);

			const key_indicator = document.createElement('span')
			key_indicator.classList.add('keyboard');
			key_indicator.textContent = key
			entry.appendChild(key_indicator);
		}	
	});

	// Show/hide overlay
	register_keyboard_action('z', () => {
		debug_overlay.classList.toggle('hide');
	})

	// Save texture as image
	function save_texture() {
		const tex_buffer = selected_tex.draw_texture_to_buffer({mouse_offset, zoom_factor});
		framebuffer_to_image_download(regl, tex_buffer, `${selected_tex.name}.png`);
	}

	register_keyboard_action('s', save_texture);
	document.getElementById('btn-screenshot').addEventListener('click', save_texture);

	/*---------------------------------------------------------------
		Frame render
	---------------------------------------------------------------*/
	regl.frame((frame) => {
		// only draw when something has changed
		if(update_needed) {
			update_needed = false; // do this *before* running the drawing code so we don't keep updating if drawing throws an error.
			regl.clear({color: [0, 0, 0, 1]});
			selected_tex.draw_texture_to_buffer({mouse_offset, zoom_factor});
			selected_tex.draw_buffer_to_screen();
		}

// 		debug_text.textContent = `
// Hello! Sim time is ${sim_time.toFixed(2)} s
// `;
	});
}

DOM_loaded_promise.then(main);

