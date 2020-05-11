"use strict";

const {mat2, mat4, mat3, vec4, vec3, vec2} = glMatrix;
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment

const deg_to_rad = Math.PI / 180;

const mesh_uvsphere = icg_mesh_make_uv_sphere(10);

async function main() {
	/* const in JS means the variable will not be bound to a new value, but the value can be modified (if its an object or array)
		https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
	*/

	const debug_overlay = document.getElementById('debug-overlay');

	// We are using the REGL library to work with webGL
	// http://regl.party/api
	// https://github.com/regl-project/regl/blob/master/API.md

	const regl = createREGL({ // the canvas to use
		profile: true, // if we want to measure the size of buffers/textures in memory
		extensions: ['oes_texture_float'], // enable float textures
	});

	// The <canvas> (HTML element for drawing graphics) was created by REGL, lets take a handle to it.
	const canvas_elem = document.getElementsByTagName('canvas')[0];
	const debug_text = document.getElementById('debug-text');

	let update_needed = true;

	{
		// Resize canvas to fit the window, but keep it square.
		function resize_canvas() {
			canvas_elem.width = window.innerWidth;
			canvas_elem.height = window.innerHeight;

			update_needed = true;
		}
		resize_canvas();
		window.addEventListener('resize', resize_canvas);
	}

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
	const resources = {
		'sun': load_texture(regl, './textures/sun.jpg'),
		'shader_shadowmap_gen_vert': load_text('./src/shaders/shadowmap_gen.vert'), //for shadowmap
		'shader_shadowmap_gen_frag': load_text('./src/shaders/shadowmap_gen.frag'),
		'shader_vis_vert': load_text('./src/shaders/cubemap_visualization.vert'),
		'shader_vis_frag': load_text('./src/shaders/cubemap_visualization.frag'),
	};

	[
		"noise.frag",
		"display.vert",

		"terrain.vert", //phong for terrain
		"terrain.frag",

		"buffer_to_screen.vert",
		"buffer_to_screen.frag",

		"sphere.vert", //for sun
		"sphere.frag",
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
		GPU pipeline
	---------------------------------------------------------------*/
	// Define the GPU pipeline used to draw a sphere
	const draw_sphere = regl({
		// Vertex attributes
		attributes: {
			// 3 vertices with 2 coordinates each
			position: mesh_uvsphere.vertex_positions,
			tex_coord: mesh_uvsphere.vertex_tex_coords,
		},
		// Faces, as triplets of vertex indices
		elements: mesh_uvsphere.faces,

		// Uniforms: global data available to the shader
		uniforms: {
			mat_mvp: regl.prop('mat_mvp'),
			texture_base_color: regl.prop('tex_base_color'),
		},

		// Vertex shader program
		// Given vertex attributes, it calculates the position of the vertex on screen
		// and intermediate data ("varying") passed on to the fragment shader
		vert: resources['shaders/sphere.vert'],

		// Fragment shader
		// Calculates the color of each pixel covered by the mesh.
		// The "varying" values are interpolated between the values given by the vertex shader on the vertices of the current triangle.
		frag: resources['shaders/sphere.frag'],
	});

	/*---------------------------------------------------------------
		Camera
	---------------------------------------------------------------*/
	const mat_world_to_cam = mat4.create();
	const cam_distance_base = 0.75;

	let cam_angle_z = -0.5; // in radians!
	let cam_angle_y = -0.42; // in radians!
	let cam_distance_factor = 1.;

	let cam_target = [0, 0, 0];

	function update_cam_transform() {
		/* TODO copy
		* Copy your solution to Task 2.2 of assignment 5.
		Calculate the world-to-camera transformation matrix.
		The camera orbits the scene
		* cam_distance_base * cam_distance_factor = distance of the camera from the (0, 0, 0) point
		* cam_angle_z - camera ray's angle around the Z axis
		* cam_angle_y - camera ray's angle around the Y axis

		* cam_target - the point we orbit around
		*/

		/* TODO 2.2
		Calculate the world-to-camera transformation matrix.
		The camera orbits the scene
		* cam_distance_base * cam_distance_factor = distance of the camera from the (0, 0, 0) point
		* cam_angle_z - camera ray's angle around the Z axis
		* cam_angle_y - camera ray's angle around the Y axis
		*/

		let r = cam_distance_base * cam_distance_factor

		let mat_rotY = mat4.fromYRotation(mat4.create(), cam_angle_y)
		let mat_rotZ = mat4.fromZRotation(mat4.create(), cam_angle_z)
		let mat_trans = mat4.fromTranslation(mat4.create(), [r, 0, 0] )

		// Example camera matrix, looking along forward-X, edit this
		const look_at = mat4.lookAt(mat4.create(),
			[-1, 0, 0], // camera position in world coord
			[0, 0, 0], // view target point
			[0, 0, 1], // up vector
		);
		mat4_matmul_many(mat_world_to_cam, look_at, mat_trans, mat_rotY, mat_rotZ);
	}

	update_cam_transform();

	// Prevent clicking and dragging from selecting the GUI text.
	canvas_elem.addEventListener('mousedown', (event) => { event.preventDefault(); });

	// Rotate camera position by dragging with the mouse
	window.addEventListener('mousemove', (event) => {
		// if left or middle button is pressed
		if (event.buttons & 1 || event.buttons & 4) {
			if (event.shiftKey) {
				const r = mat2.fromRotation(mat2.create(), -cam_angle_z);
				const offset = vec2.transformMat2([0, 0], [event.movementY, event.movementX], r);
				vec2.scale(offset, offset, -0.01);
				cam_target[0] += offset[0];
				cam_target[1] += offset[1];
			} else {
				cam_angle_z += event.movementX*0.005;
				cam_angle_y += -event.movementY*0.005;
			}
			update_cam_transform();
			update_needed = true;
		}

	});

	window.addEventListener('wheel', (event) => {
		// scroll wheel to zoom in or out
		const factor_mul_base = 1.08;
		const factor_mul = (event.deltaY > 0) ? factor_mul_base : 1./factor_mul_base;
		cam_distance_factor *= factor_mul;
		cam_distance_factor = Math.max(0.1, Math.min(cam_distance_factor, 4));
		// console.log('wheel', event.deltaY, event.deltaMode);
		event.preventDefault(); // don't scroll the page too...
		update_cam_transform();
		update_needed = true;
	})

	/*---------------------------------------------------------------
		Actors
	---------------------------------------------------------------*/

	const noise_textures = init_noise(regl, resources);

	const texture_fbm = (() => {
		for(const t of noise_textures) {
			//if(t.name === 'FBM') {
			if(t.name === 'FBM_for_terrain') {
				return t;
			}
		}
	})();

	texture_fbm.draw_texture_to_buffer({width: 300, height: 200, mouse_offset: [0.24, 8.15]});

	const terrain_actor = init_terrain(regl, resources, texture_fbm.get_buffer());

	/*
		UI
	*/
	register_keyboard_action('z', () => {
		debug_overlay.classList.toggle('hide');
	})


	function activate_preset_view() {
		cam_angle_z = -1.0;
		cam_angle_y = -0.42;
		cam_distance_factor = 1.0;
		cam_target = [0, 0, 0];

		update_cam_transform();
		update_needed = true;
	}
	activate_preset_view();

	document.getElementById('btn-preset-view').addEventListener('click', activate_preset_view);
	register_keyboard_action('c', activate_preset_view);

	function calculate_actor_to_world_transform(actor, translation) {
		const mat_trans = mat4.fromTranslation(mat4.create(), translation)
		const mat_scale = mat4.fromScaling(mat4.create(), [actor.size, actor.size, actor.size])
		mat4_matmul_many(actor.mat_model_to_world, mat_trans, mat_scale);
	}

	const actors_by_name = {
		sun: {
			orbits: null,
			texture: resources.sun,
			size: 0.1,
			rotation_speed: 0.1,
		},
	}

	//keep this in case later we add more object to our world
	const actors_list = [actors_by_name.sun]

	for (const actor of actors_list) {
		// initialize transform matrix
		actor.mat_model_to_world = mat4.create();
	}

	/*---------------------------------------------------------------
		Frame render
	---------------------------------------------------------------*/
	const mat_projection = mat4.create();
	const mat_view = mat4.create();
	const mat_mvp = mat4.create();

	let light_position_world = [-1, -1, 0., 1.0];

	const light_position_cam = [0, 0, 0, 0];

	regl.frame((frame) => {
		const sim_time = frame.time

		if(update_needed) {
			update_needed = false; // do this *before* running the drawing code so we don't keep updating if drawing throws an error.

			mat4.perspective(mat_projection,
				deg_to_rad * 60, // fov y
				frame.framebufferWidth / frame.framebufferHeight, // aspect ratio
				0.01, // near
				100, // far
			)

			mat4.copy(mat_view, mat_world_to_cam);

			// Calculate light position in camera frame
			vec4.transformMat4(light_position_cam, light_position_world, mat_view);

			const scene_info = {
				mat_view:        mat_view,
				mat_projection:  mat_projection,
				light_position_world: light_position_world,
				light_position_cam: light_position_cam,
			}

			// Set backgorund color
			regl.clear({color: [0.9, 0.9, 1., 1]});

			terrain_actor.render_shadowmap(scene_info);
			terrain_actor.draw_phong_contribution(scene_info);
			terrain_actor.visualize_distance_map();

			for (const actor of actors_list) {
				calculate_actor_to_world_transform(actor, light_position_world.slice(0,3));

				mat4_matmul_many(mat_mvp, mat_projection, mat_world_to_cam, actor.mat_model_to_world)

				draw_sphere({
					mat_mvp: mat_mvp,
					tex_base_color: actor.texture,
				});
				// for better performance we should collect these props and then draw them all together
				// http://regl.party/api#batch-rendering
			}
		}

		debug_text.textContent = `
		Hello! Sim time is ${sim_time.toFixed(2)} s
		Camera: angle_z ${(cam_angle_z / deg_to_rad).toFixed(1)}, angle_y ${(cam_angle_y / deg_to_rad).toFixed(1)}, distance ${(cam_distance_factor*cam_distance_base).toFixed(1)}
		`;
	});
}

DOM_loaded_promise.then(main);
