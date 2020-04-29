
"use strict"; // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
const {mat4, mat3, vec4, vec3, vec2} = glMatrix;

const deg_to_rad = Math.PI / 180;

var regl_global_handle = null; // store the regl context here in case we want to touch it in devconsole

async function main() {
	/* `const` in JS means the variable will not be bound to a new value, but the value can be modified (if its an object or array)
		https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
	*/
	// Canvas is the element on which we draw 
	const canvas_elem = document.getElementsByTagName('canvas')[0];
	// debug_text is a box in which we display some text in real time 
	const debug_text = document.getElementById('debug-text');

	// Resize canvas to fit the window, but keep it square.
	function resize_canvas() {
		const s = Math.min(window.innerHeight, window.innerWidth) - 10;
		canvas_elem.width = s;
		canvas_elem.height = s;
	}
	resize_canvas();
	window.addEventListener('resize', resize_canvas);

	// We are using the REGL library to work with webGL
	// http://regl.party/api
	// https://github.com/regl-project/regl/blob/master/API.md
	const regl = createREGL(canvas_elem, {
		profile: true, // if we want to measure the size of buffers/textures in memory
	});
	regl_global_handle = regl;


	/*---------------------------------------------------------------
		GPU pipeline
	---------------------------------------------------------------*/
	// Define the GPU pipeline used to draw a triangle, vertex positions are translated by an offset.
	const draw_triangle_with_offset = regl({
		// Vertex attributes
		attributes: {
			// 3 vertices with 2 coordinates each
			position: [
				[0, 0.2],
				[-0.2, -0.2],
				[0.2, -0.2],
			],
		},
		// Triangles (faces), as triplets of vertex indices
		elements: [
			[0, 1, 2],
		],

		// Uniforms: global data available to the shader
		uniforms: {
			/* regl.prop('something') means that the data is passed during the draw call, for example:
				draw_triangle_with_offset({
					mouse_offset: ....,
					color: ....,
				})
			*/
			mouse_offset: regl.prop('mouse_offset'),
			color: regl.prop('color'),
		},	

		/* 
		Vertex shader program
		Given vertex attributes, it calculates the position of the vertex on screen
		and intermediate data ("varying") passed on to the fragment shader
		*/
		vert: `
		// Vertex attributes, specified in the "attributes" entry of the pipeline
		attribute vec2 position;
				
		// Global variables specified in "uniforms" entry of the pipeline
		uniform vec2 mouse_offset;

		void main() {
			// TODO 1.1.1 Edit the vertex shader to apply mouse_offset translation to the vertex position.
			// We have to return a vec4, because homogenous coordinates are being used.
			gl_Position = vec4(position + mouse_offset, 0, 1);
		}`,
			
		/* 
		Fragment shader program
		Calculates the color of each pixel covered by the mesh.
		The "varying" values are interpolated between the values given by the vertex shader on the vertices of the current triangle.
		*/
		frag: `
		precision mediump float;
		
		uniform vec3 color;

		void main() {
			gl_FragColor = vec4(color, 1.); // output: RGBA in 0..1 range
		}`,
	});

	// Define the GPU pipeline used to draw a triangle, a transformation matrix is applied to the vertex positions.
	const draw_triangle_with_transform = regl({
		// Vertex attributes
		attributes: {
			// 3 vertices with 2 coordinates each
			position: [
				[0, 0.2],
				[-0.2, -0.2],
				[0.2, -0.2],
			],
		},
		// Triangles (faces), as triplets of vertex indices
		elements: [
			[0, 1, 2],
		],

		vert: `
		// Vertex attributes, specified in the "attributes" entry of the pipeline
		attribute vec2 position;
				
		// Global variables specified in "uniforms" entry of the pipeline
		uniform mat4 mat_transform;

		void main() {
			// TODO 1.2.1 Edit the vertex shader to apply mat_transform to the vertex position.
			gl_Position = mat_transform * vec4(position, 0, 1);
		}`,
		
		frag: `
		precision mediump float;
		
		uniform vec3 color;

		void main() {
			gl_FragColor = vec4(color, 1.); // output: RGBA in 0..1 range
		}`,

		// Uniforms: global data available to the shader
		uniforms: {
			mat_transform: regl.prop('mat_transform'),
			color: regl.prop('color'),
		},	
	});

	/*---------------------------------------------------------------
		Drag with mouse
	---------------------------------------------------------------*/
	/* `const` in JS means the variable will not be bound to a new value, but the value can be modified (if its an object or array)
		https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
		Here we keep the same array but change the numerical values inside.
	*/
	const mouse_offset = [0, 0];

	// Register the functions to be executed when the mouse moves
	canvas_elem.addEventListener('mousemove', (event) => {
		// if left or middle button is pressed
		if (event.buttons & 1 || event.buttons & 4) {
			// The GPU coordinate frame is from bottom left [-1, -1] to top right [1, 1].
			// therefore the scale from pixels to canvas is  2 / [width, height] and we have to invert Y because pixel offsets are counted from the top-left corner.
			mouse_offset[0] += 2 * event.movementX / canvas_elem.clientWidth;
			mouse_offset[1] += -2 * event.movementY / canvas_elem.clientHeight;

			/*
			This handler function has access to the mouse_offset variable from its closure:
			https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures
			*/
		}
	});


	/*---------------------------------------------------------------
		Render frame
	---------------------------------------------------------------*/
	const color_red = [1.0, 0.3, 0.2];
	const color_green = [0.5, 1.0, 0.2];
	const color_blue = [0.2, 0.5, 1.0];

	// Matrices allocated for reuse, you do not have to use them
	const mat_transform = mat4.create();
	const mat_rotation = mat4.create();
	const mat_translation = mat4.create();


	// Function run to render a new frame
	// This is the "arrow" syntax of defining a function https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
	regl.frame((frame) => {
		const sim_time = frame.time;

		// Set the whole image to black
		regl.clear({color: [0, 0, 0, 1]});


		// TODO 1.1.2 Draw the blue triangle translated by mouse_offset
		
		draw_triangle_with_offset({
			mouse_offset: mouse_offset,
			color: color_blue,
		});

		/*
		TODO 1.2.2
			Construct a translation matrix for vector [0.5, 0, 0], 
			and a rotation around Z for angle (time * 30 deg). 
			Multiply the matrices in appropriate order and call the pipeline to obtain:
    			* a green triangle orbiting the center point
				* a red triangle spinning at [0.5, 0, 0]
			You do not have to apply the mouse_offset to them.
		*/
		mat4.fromZRotation(mat_rotation, 2 * Math.PI / 12 * sim_time)
		mat4.fromTranslation(mat_translation, [0.5, 0, 0])
		mat4_matmul_many(mat_transform, mat_rotation, mat_translation)
		
		draw_triangle_with_transform({
			mat_transform: mat_transform,
			color: color_green,
		});
		
		mat4_matmul_many(mat_transform, mat_translation, mat_rotation)

		draw_triangle_with_transform({
			mat_transform: mat_transform,
			color: color_red,
		});

		// You can write whatever you need in the debug box
		debug_text.textContent = `
Hello! Sim time: ${sim_time.toFixed(2)} s | Mouse offset: ${vec_to_string(mouse_offset, 2)}
`;
	})
}

// Run the main function when the doument has been loaded, see icg_web.js
DOM_loaded_promise.then(main);
