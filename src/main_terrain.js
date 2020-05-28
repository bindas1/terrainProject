"use strict";

const {mat2, mat4, mat3, vec4, vec3, vec2} = glMatrix;
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment

const deg_to_rad = Math.PI / 180;

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

	{
		// Resize canvas to fit the window, but keep it square.
		function resize_canvas() {
			canvas_elem.width = window.innerWidth;
			canvas_elem.height = window.innerHeight;
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
		'shader_shadowmap_gen_vert': load_text('./src/shaders/shadowmap_gen.vert'), //for shadowmap
		'shader_shadowmap_gen_frag': load_text('./src/shaders/shadowmap_gen.frag'),
		'shader_vis_vert': load_text('./src/shaders/cubemap_visualization.vert'),
		'shader_vis_frag': load_text('./src/shaders/cubemap_visualization.frag'),
		'new_terrain': load_mesh_obj(regl, './meshes/newTerrain7_double_very_close.obj'),

		//sun
		'shader_billboard_vert': load_text('./src/shaders/billboard_sun.vert'),
		'shader_billboard_frag': load_text('./src/shaders/billboard_sun.frag'),

		//cloud
		'shader_billboard_cloud_vert': load_text('./src/shaders/billboard_cloud.vert'),
		'shader_billboard_cloud_frag': load_text('./src/shaders/billboard_cloud.frag'),
		'cloud_texture': load_texture(regl, './textures/texture.jpg'),
		'cloud_shape': load_texture(regl, './textures/cloud.jpg'),
	};

	[
		"noise.frag",
		"display.vert",

		"terrain.vert", //phong for terrain
		"terrain.frag",

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
		GPU pipeline
	---------------------------------------------------------------*/

	// Define the GPU pipeline used to draw a billboard for the sun
	const draw_billoard_sun = regl({
		// Vertex attributes
		attributes: {
			// 4 vertices with 3 coordinates each
			position: [
				[-1, -1, 0],
				[1, -1, 0],
				[1, 1, 0],
				[-1, 1, 0],
			],
		},

		// Faces, as triplets of vertex indices
		elements: [
			[0, 1, 2], // top right
			[0, 2, 3], // bottom left
		],

		// Uniforms: global data available to the shader
		uniforms: {
			mat_mvp: regl.prop('mat_mvp'),
		},

		// Vertex shader program
		vert: resources.shader_billboard_vert,
		frag: resources.shader_billboard_frag,

		blend : {
			enable: true,
			func: {
				srcRGB: 'src alpha',
				srcAlpha: 1,
				dstRGB: 'one minus src alpha',
				dstAlpha: 1
			},
			equation: {
				rgb: 'add',
				alpha: 'add'
			},
		}
	});

		// Define the GPU pipeline used to draw a billboard for the sun
		const draw_billoard_cloud = regl({
			// Vertex attributes
			attributes: {
				// 4 vertices with 3 coordinates each
				position: [
					[-1, -1, 0],
					[1, -1, 0],
					[1, 1, 0],
					[-1, 1, 0],
				],
			},

			// Faces, as triplets of vertex indices
			elements: [
				[0, 1, 2], // top right
				[0, 2, 3], // bottom left
			],

			// Uniforms: global data available to the shader
			uniforms: {
				mat_mvp: regl.prop('mat_mvp'),
				height_map: regl.prop('height_map'),
				cloud_shape_map: resources.cloud_shape,
				cloud_noise_map: resources.cloud_texture,
				sim_time: regl.prop('sim_time'),
			},

			// Vertex shader program
			vert: resources.shader_billboard_cloud_vert,
			frag: resources.shader_billboard_cloud_frag,

			blend : {
				enable: true,
				func: {
					srcRGB: 'src alpha',
					srcAlpha: 1,
					dstRGB: 'one minus src alpha',
					dstAlpha: 1
				},
				equation: {
					rgb: 'add',
					alpha: 'add'
				},
			}
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
		}

	});
	let mouse_offset = [0, 0];
	window.addEventListener('wheel', (event) => {
		// scroll wheel to zoom in or out
		const factor_mul_base = 1.08;
		const factor_mul = (event.deltaY > 0) ? factor_mul_base : 1./factor_mul_base;
		cam_distance_factor *= factor_mul;
		cam_distance_factor = Math.max(0.5, Math.min(cam_distance_factor, 1.5));
		// console.log('wheel', event.deltaY, event.deltaMode);
		event.preventDefault(); // don't scroll the page too...
		update_cam_transform();
	})

	let speed = 0.1;

	// down
	register_keyboard_action('s', () => {
		let x_offset = Math.cos(cam_angle_z);
		let y_offset = -Math.sin(cam_angle_z);

		mouse_offset[0] += x_offset * speed;
		mouse_offset[1] += y_offset * speed;

		//mouse_offset[0] += 0.1;
	})

	// up
	register_keyboard_action('w', () => {
		let x_offset = -Math.cos(cam_angle_z);
		let y_offset = Math.sin(cam_angle_z);

		mouse_offset[0] += x_offset * speed;
		mouse_offset[1] += y_offset * speed;

		// for 0 degrees
		// mouse_offset[0] -= 0.1;
	})

	// right
	register_keyboard_action('d', () => {
		let x_offset = Math.cos(cam_angle_z);
		let y_offset = Math.sin(cam_angle_z);

		mouse_offset[1] += x_offset * speed;
		mouse_offset[0] += y_offset * speed;
	})

	// left
	register_keyboard_action('a', () => {
		// for 0 degrees needs to be -1
		let x_offset = -Math.cos(cam_angle_z);
		let y_offset = -Math.sin(cam_angle_z);

		mouse_offset[1] += x_offset * speed;
		mouse_offset[0] += y_offset * speed;
	})


	// Prevent clicking and dragging from selecting the GUI text.
	canvas_elem.addEventListener('mousedown', (event) => { event.preventDefault(); });


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

	texture_fbm.draw_texture_to_buffer({width: 96, height: 96, mouse_offset, zoom_factor: 10.});
	//texture_fbm.draw_buffer_to_screen();
	let terrain_actor = init_terrain(regl, resources, texture_fbm.get_buffer());

	texture_fbm.draw_texture_to_buffer({mouse_offset, zoom_factor: 3.});

	function cloud_mvp(mat_projection, mat_view, x, y, z, scale_x, scale_y, scale_z, angle = 0) {

		const mat_mvp = mat4.create()

		const mat_trans_cloud = mat4.fromTranslation(mat4.create(), [x, y, z])
		const mat_rot_x_cloud = mat4.fromXRotation(mat4.create(), -Math.PI/4)
		const mat_rot_z_cloud = mat4.fromZRotation(mat4.create(), angle)
		const mat_scale_cloud = mat4.fromScaling(mat4.create(), [scale_x, scale_y, scale_z])

		const mat_model_to_world_cloud = mat4_matmul_many(mat4.create(), mat_rot_z_cloud, mat_trans_cloud, mat_rot_x_cloud, mat_scale_cloud)

		mat4_matmul_many(mat_mvp, mat_projection, mat_view, mat_model_to_world_cloud)

		return mat_mvp
	}

	/*
		UI
	*/
	register_keyboard_action('z', () => {
		debug_overlay.classList.toggle('hide');
	})

	let is_paused = false;
	let sim_time = 0;
	let prev_regl_time = 0;
	register_keyboard_action('p', () => is_paused = !is_paused);

	let show_shadowmap_debug = false;
	register_keyboard_action('h', () => show_shadowmap_debug = !show_shadowmap_debug);

	function activate_preset_view() {
		is_paused = true;
		cam_angle_z = -1.0;
		cam_angle_y = -0.42;
		cam_distance_factor = 1.0;
		cam_target = [0, 0, 0];

		update_cam_transform();
	}
	activate_preset_view();

	document.getElementById('btn-preset-view').addEventListener('click', activate_preset_view);
	register_keyboard_action('c', activate_preset_view);

	/*---------------------------------------------------------------
		Frame render
	---------------------------------------------------------------*/
	const mat_projection = mat4.create();
	const mat_view = mat4.create();
	const mat_mvp = mat4.create();

	const light_position_world_start = [-100, 0, 0];

	const light_position_cam = [0, 0, 0, 0];

	regl.frame((frame) => {
		if (! is_paused) {
			const dt = frame.time - prev_regl_time;
			sim_time += dt;
		}
		prev_regl_time = frame.time;

		regl.clear({color: [0.6, 0.8, 1., 1]});

		const light_position_world = vec3.rotateY(vec3.create(), light_position_world_start, [0,0,0], sim_time*0.3).concat(1);

		mat4.perspective(mat_projection,
			deg_to_rad * 60, // fov y
			frame.framebufferWidth / frame.framebufferHeight, // aspect ratio
			0.01, // near
			100, // far
		)

		texture_fbm.draw_texture_to_buffer({width: 3000, height: 3000, mouse_offset, zoom_factor: 10.});
		//texture_fbm.draw_buffer_to_screen();

		mat4.copy(mat_view, mat_world_to_cam);

		// Calculate light position in camera frame
		vec4.transformMat4(light_position_cam, light_position_world, mat_view);

		const scene_info = {
			mat_view:        mat_view,
			mat_projection:  mat_projection,
			light_position_world: light_position_world,
			light_position_cam: light_position_cam,
			sim_time:        sim_time,
		}

		// Set background color
		// const sunset_red_color = [1, 60/255, 60/255, 1];
		// const sunset_orange_color = [253/255, 94/255, 83/255,1];
		const sunset_pink_color = [246/255, 114/255, 128/255, 1];
		const sky_blue_color = [135/255, 206/255, 235/255, 1];
		const night_black_color = [7/255, 11/255, 52/255, 1];

		const normalized_light_position_world = vec3.normalize(vec3.create(), light_position_world);
		const angle = Math.acos(vec3.dot(normalized_light_position_world, [0,0,1]));

		let color;
		if (angle < Math.PI/2){
			const val_btw_zero_and_one = 2*angle/Math.PI; //angle is between 0 and pi/2. so divide by pi/2 to get btw 0->1
			color = vec4.lerp(vec4.create(), sky_blue_color, sunset_pink_color, Math.exp(1-1/Math.pow(val_btw_zero_and_one, 2)));
		} else {
			const val_btw_zero_and_one = 2*(Math.PI - angle)/Math.PI; //angle is btw pi/2 and pi. so I do pi - angle to get it btwn 0 and pi/2 and do like above
			color = vec4.lerp(vec4.create(), night_black_color, sunset_pink_color, Math.exp(1-1/Math.pow(val_btw_zero_and_one, 2)));
		}
		regl.clear({color: color});

		terrain_actor.render_shadowmap(scene_info);
		terrain_actor.draw_phong_contribution(scene_info);
		if (show_shadowmap_debug){
			terrain_actor.visualize_distance_map();
		}

		//// ========== Add billboard for sun =====================

		const camera_position = [0, 0, 0];
		const mat_camera_to_world = mat4.invert(mat4.create(), mat_view);
		mat4.getTranslation(camera_position, mat_camera_to_world);

		let nb = vec3.normalize(vec3.create(), camera_position)
		let z = [0,0,1]

		const closer_light_position = vec4FromVec3(vec3.scale(vec3.create(), vec3FromVec4(light_position_world), 0.1), 1);
		const mat_trans = mat4.fromTranslation(mat4.create(), closer_light_position)

		let angle_sun = Math.acos(vec3.dot(nb, z))
		let axis = vec3.cross(vec3.create(), nb, z)
		let mat_rot = mat4.fromRotation(mat4.create(), -angle_sun, axis)

		let dist = 2
		const mat_scale = mat4.fromScaling(mat4.create(), [dist, dist, dist])
		const mat_model_to_world = mat4_matmul_many(mat4.create(), mat_trans, mat_rot, mat_scale)

		mat4_matmul_many(mat_mvp, mat_projection, mat_view, mat_model_to_world);

		draw_billoard_sun({
			mat_mvp: mat_mvp,
		})

		//// ========== Add billboard for cloud ====================

		draw_billoard_cloud(
			[
				{
					mat_mvp: cloud_mvp(mat_projection, mat_view, 1,5,3, 4,4,4),
					height_map: texture_fbm.get_buffer(),
					sim_time: sim_time+1,
				},
				{
					mat_mvp: cloud_mvp(mat_projection, mat_view, 0,5,2.8, 4,4,4, Math.PI*0.9),
					height_map: texture_fbm.get_buffer(),
					sim_time: sim_time+3,
				},
				{
					mat_mvp: cloud_mvp(mat_projection, mat_view, 0,5,3, 6,4,4, Math.PI*1.4),
					height_map: texture_fbm.get_buffer(),
					sim_time: sim_time+5,
				},
			]
		)

		debug_text.textContent = `
		Hello! Sim time is ${sim_time.toFixed(2)} s
		Camera: angle_z ${(cam_angle_z / deg_to_rad).toFixed(1)}, angle_y ${(cam_angle_y / deg_to_rad).toFixed(1)}, distance ${(cam_distance_factor*cam_distance_base).toFixed(1)}
		, degrees (0-90 0-1 90-180 1-2 180-270 2-3) ${((Math.abs(cam_angle_z / deg_to_rad)) % 360) / 90}, cos from radian ${(Math.cos(cam_angle_z))},sin from radian ${(Math.sin(cam_angle_z))}`;
	});
}

DOM_loaded_promise.then(main);
