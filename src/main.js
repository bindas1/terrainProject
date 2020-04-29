
"use strict";
const {mat4, mat3, vec4, vec3, vec2} = glMatrix;
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment

const deg_to_rad = Math.PI / 180;

// Construct a unit sphere mesh
// UV sphere https://docs.blender.org/manual/en/latest/modeling/meshes/primitives.html#uv-sphere
const mesh_uvsphere = icg_mesh_make_uv_sphere(10);


var regl_global_handle = null; // store the regl context here in case we want to touch it in devconsole

async function main() {
	/* const in JS means the variable will not be bound to a new value, but the value can be modified (if its an object or array)
		https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
	*/

	// We are using the REGL library to work with webGL
	// http://regl.party/api
	// https://github.com/regl-project/regl/blob/master/API.md
	const regl = createREGL({
		profile: true, // if we want to measure the size of buffers/textures in memory
	});
	regl_global_handle = regl;
	// The <canvas> (HTML element for drawing graphics) was created by REGL, lets take a handle to it.
	const canvas_elem = document.getElementsByTagName('canvas')[0];

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
	* edit config in firefox
		security.fileuri.strict_origin_policy = false
	*/

	// Start downloads in parallel
	const textures = {
		'sun': load_texture(regl, './textures/sun.jpg'),
		'earth': load_texture(regl, './textures/earth_day_s.jpg'),
		'moon': load_texture(regl, './textures/moon.jpg'),
		'mars': load_texture(regl, './textures/mars.jpg'),
	}

	// Wait for all downloads to complete
	for (const key in textures) {
		if (textures.hasOwnProperty(key)) {
			textures[key] = await textures[key]
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
		vert: `
		// Vertex attributes, specified in the "attributes" entry of the pipeline
		attribute vec3 position;
		attribute vec2 tex_coord;

		// Per-vertex outputs passed on to the fragment shader
		varying vec2 v2f_tex_coord;

		// Global variables specified in "uniforms" entry of the pipeline
		uniform mat4 mat_mvp;

		void main() {
			v2f_tex_coord = tex_coord;
			// TODO 2.1.1 Edit the vertex shader to apply mat_mvp to the vertex position.
			gl_Position = mat_mvp * vec4(position, 1);
		}`,

		// Fragment shader
		// Calculates the color of each pixel covered by the mesh.
		// The "varying" values are interpolated between the values given by the vertex shader on the vertices of the current triangle.
		frag: `
		precision mediump float;

		varying vec2 v2f_tex_coord;

		uniform sampler2D texture_base_color;

		void main() {
			vec3 color_from_texture = texture2D(texture_base_color, v2f_tex_coord).rgb;

			gl_FragColor = vec4(color_from_texture, 1.); // output: RGBA in 0..1 range
		}`,
	});

	const mat_mvp = mat4.create();
	const mat_projection = mat4.create();

	/*---------------------------------------------------------------
		Camera
	---------------------------------------------------------------*/
	const mat_world_to_cam = mat4.create();
	const cam_distance_base = 20;

	let cam_angle_z = Math.PI * 0.2; // in radians!
	let cam_angle_y = -Math.PI / 6; // in radians!
	let cam_distance_factor = 1.;

	function update_cam_transform() {
		/* TODO 2.2
		Calculate the world-to-camera transformation matrix.
		The camera orbits the scene
		* cam_distance_base * cam_distance_factor = distance of the camera from the (0, 0, 0) point
		* cam_angle_z - camera ray's angle around the Z axis
		* cam_angle_y - camera ray's angle around the Y axis
		*/

		// distance to [0, 0, 0]
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

		// Store the combined transform in mat_world_to_cam
		// mat_world_to_cam = A * B * ...
		mat4_matmul_many(mat_world_to_cam, look_at, mat_trans, mat_rotY, mat_rotZ); // edit this
	}

	update_cam_transform();

	// Rotate camera position by dragging with the mouse
	canvas_elem.addEventListener('mousemove', (event) => {
		// if left or middle button is pressed
		if (event.buttons & 1 || event.buttons & 4) {
			cam_angle_z += event.movementX*0.005;
			cam_angle_y += -event.movementY*0.005;

			update_cam_transform();
		}
	});

	canvas_elem.addEventListener('wheel', (event) => {
		// scroll wheel to zoom in or out
		const factor_mul_base = 1.08;
		const factor_mul = (event.deltaY > 0) ? factor_mul_base : 1./factor_mul_base;
		cam_distance_factor *= factor_mul;
		cam_distance_factor = Math.max(0.1, Math.min(cam_distance_factor, 4));
		// console.log('wheel', event.deltaY, event.deltaMode);
		update_cam_transform();
	})

	/*---------------------------------------------------------------
		Actors
	---------------------------------------------------------------*/

	const actors_by_name = {
		sun: {
			orbits: null,
			texture: textures.sun,
			size: 2.5,
			rotation_speed: 0.1,
		},
		earth: {
			orbits: 'sun',
			texture: textures.earth,
			size: 1,
			rotation_speed: 1.0,
			orbit_radius: 6,
			orbit_speed: 0.2,
			orbit_phase: 1.7,
		},
		moon: {
			orbits: 'earth',
			texture: textures.moon,
			size: 0.25,
			rotation_speed: 0.6,
			orbit_radius: 1.6,
			orbit_speed: 0.6,
			orbit_phase: 0.5,
		},
		mars: {
			orbits: 'sun',
			texture: textures.mars,
			size: 0.75,
			rotation_speed: 1.4,
			orbit_radius: 8.0,
			orbit_speed: 0.1,
			orbit_phase: 0.1,
		},
	};
	// actors in the order they should be drawn
	const actors_list = [actors_by_name.sun, actors_by_name.earth, actors_by_name.moon, actors_by_name.mars];


	for (const actor of actors_list) {
		// initialize transform matrix
		actor.mat_model_to_world = mat4.create();

		// resolve orbits by name
		if(actor.orbits !== null) {
			actor.orbits = actors_by_name[actor.orbits];
		}
	}

	function calculate_actor_to_world_transform(actor, sim_time) {

		/*
		TODO 2.3
		Construct the model matrix for the current planet and store it in actor.mat_model_to_world.

		Orbit (if the parent actor.orbits is not null)
			radius = actor.orbit_radius
			angle = sim_time * actor.orbit_speed + actor.orbit_phase
			around parent's position (actor.orbits.mat_model_to_world)

		Spin around the planet's Z axis
			angle = sim_time * actor.rotation_speed (radians)

		Scale the unit sphere to match the desired size
			scale = actor.size
			mat4.fromScaling takes a 3D vector!
		*/

		const M_orbit = mat4.create();

		const angle_spin = sim_time * actor.rotation_speed

		const mat_rotZ = mat4.fromZRotation(mat4.create(), angle_spin)

		const mat_scale = mat4.fromScaling(mat4.create(), [actor.size, actor.size, actor.size])

		if(actor.orbits !== null) {
			// Parent's translation
			const parent_translation_v = mat4.getTranslation([0, 0, 0], actor.orbits.mat_model_to_world);
      const mat_trans_parent = mat4.fromTranslation(mat4.create(), parent_translation_v)

			const angle_orbit = sim_time * actor.orbit_speed + actor.orbit_phase

			const mat_rotOrbit = mat4.fromZRotation(mat4.create(), angle_orbit)

			const radius = actor.orbit_radius

			const mat_trans_around_parent = mat4.fromTranslation(mat4.create(), [radius, 0, 0] )

			mat4_matmul_many(M_orbit, mat_trans_parent, mat_rotOrbit, mat_trans_around_parent);

			// Orbit around the parent
		}

		// Store the combined transform in actor.mat_model_to_world
		mat4_matmul_many(actor.mat_model_to_world, M_orbit, mat_rotZ, mat_scale);
	}


	/*---------------------------------------------------------------
		Frame render
	---------------------------------------------------------------*/

	// Grid, to demonstrate keyboard shortcuts
	const draw_grid = make_grid_pipeline(regl);
	let grid_on = true;
	register_keyboard_action('g', () => grid_on = !grid_on);


	regl.frame((frame) => {
		const sim_time = frame.time;

		// Set the whole image to black
		regl.clear({color: [0, 0, 0, 1]});

		mat4.perspective(mat_projection,
			deg_to_rad * 60, // fov y
			frame.framebufferWidth / frame.framebufferHeight, // aspect ratio
			0.01, // near
			100, // far
		)

		for (const actor of actors_list) {
			calculate_actor_to_world_transform(actor, sim_time);

			// TODO 2.1.2 Calculate the MVP matrix in mat_mvp variable.
			// model matrix: actor.mat_model_to_world
			// view matrix: mat_world_to_cam
			// projection matrix: mat_projection
			mat4_matmul_many(mat_mvp, mat_projection, mat_world_to_cam, actor.mat_model_to_world)

			draw_sphere({
				mat_mvp: mat_mvp,
				tex_base_color: actor.texture,
			});
			// for better performance we should collect these props and then draw them all together
			// http://regl.party/api#batch-rendering
		}

		if (grid_on) {
			draw_grid(mat_projection, mat_world_to_cam);
		}

		debug_text.textContent = `
Hello! Sim time is ${sim_time.toFixed(2)} s
Camera: angle_z ${(cam_angle_z / deg_to_rad).toFixed(1)}, angle_y ${(cam_angle_y / deg_to_rad).toFixed(1)}, distance ${(cam_distance_factor*cam_distance_base).toFixed(1)}
mat_world_to_cam:
${mat_world_to_cam}
`;
	})
}

DOM_loaded_promise.then(main);
