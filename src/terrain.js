"use strict";

class BufferData {

	constructor(regl, buffer) {
		this.width = buffer.width;
		this.height = buffer.height;
		this.data = regl.read({framebuffer: buffer});

		// this can read both float and uint8 buffers
		if (this.data instanceof Uint8Array) {
			// uint8 array is in range 0...255
			this.scale = 1./255.;
		} else {
			this.scale = 1.;
		}

	}

	get(x, y) {
		x = Math.min(Math.max(x, 0), this.width - 1);
		y = Math.min(Math.max(y, 0), this.height - 1);

		return this.data[x + y*this.width << 2] * this.scale;
	}
}

function terrain_build_mesh(height_map) {
	const grid_width = height_map.width;
	const grid_height = height_map.height;

	const WATER_LEVEL = -0.03125;

	const vertices = [];
	const normals = [];
	const faces = [];

	// Map a 2D grid index (x, y) into a 1D index into the output vertex array.
	function xy_to_v_index(x, y) {
		return x + y*grid_width;
	}

	for(let gy = 0; gy < grid_height; gy++) {
		for(let gx = 0; gx < grid_width; gx++) {
			const idx = xy_to_v_index(gx, gy);
			let elevation = height_map.get(gx, gy) - 0.5 // we put the value between 0...1 so that it could be stored in a non-float texture on older browsers/GLES3, the -0.5 brings it back to -0.5 ... 0.5;

			// normal as finite difference of the height map
			// dz/dx = (h(x+dx) - h(x-dx)) / (2 dx)
			normals[idx] = vec3.normalize([0, 0, 0], [
				-(height_map.get(gx+1, gy) - height_map.get(gx-1, gy)) / (2. / grid_width),
				-(height_map.get(gx, gy+1) - height_map.get(gx, gy-1)) / (2. / grid_height),
				1.,
			]);

			/* TODO 6.1
			Generate the displaced terrain vertex corresponding to integer grid location (gx, gy).
			The height (Z coordinate) of this vertex is determined by height_map.
			If the point falls below WATER_LEVEL:
			* it should be clamped back to WATER_LEVEL.
			* the normal should be [0, 0, 1]

			The XY coordinates are calculated so that the full grid covers the square [-0.5, 0.5]^2 in the XY plane.
			*/
			if(elevation < WATER_LEVEL) {
				elevation = WATER_LEVEL;
				normals[idx] = [0, 0, 1];
			}
			//need to distribute gx,gy between [-0.5,0.5] i think unfortunately this doesnt seem to work ;(
			vertices[idx] = [(gx/grid_width-0.5) , (gy/grid_height-0.5), elevation];
			//vertices[idx] = [gx ,gy, elevation];
		}
	}

	for(let gy = 0; gy < grid_height - 1; gy++) {
		for(let gx = 0; gx < grid_width - 1; gx++) {
			/* TODO 6.1
			Triangulate the grid cell whose lower lefthand corner is grid index (gx, gy).
			You will need to create two triangles to fill each square.
			*/
			// faces.push([v1, v2, v3]); // adds a triangle on vertex indices v1, v2, v3
			const idx1 = xy_to_v_index(gx, gy);
			const idx2 = xy_to_v_index(gx+1, gy);
			const idx3 = xy_to_v_index(gx, gy+1);
			const idx4 = xy_to_v_index(gx+1, gy+1);
			faces.push([idx1, idx2, idx3]);
			faces.push([idx2, idx3, idx4]);
		}
	}

	return {
		vertex_positions: vertices,
		vertex_normals: normals,
		faces: faces,
	};
}


function init_terrain(regl, resources, height_map_buffer) {

	const terrain_mesh = terrain_build_mesh(new BufferData(regl, height_map_buffer));

	const shadowmap = regl.framebuffer({
		radius:      1024,
		colorFormat: 'rgba', // GLES 2.0 doesn't support single channel textures : (
		colorType:   'float',
  })

	const pipeline_shadowmap_generation = regl({
		attributes: {
			position: terrain_mesh.vertex_positions,
		},
		// Faces, as triplets of vertex indices
		elements: terrain_mesh.faces,

		// Uniforms: global data available to the shader
		uniforms: {
			mat_mvp:        regl.prop('mat_mvp'),
			mat_model_view: regl.prop('mat_model_view'),
		},

		vert: resources.shader_shadowmap_gen_vert,
		frag: resources.shader_shadowmap_gen_frag,

		// Where the result gets written to:
		framebuffer: regl.prop('out_buffer'),
  });

	const pipeline_draw_terrain = regl({
		attributes: {
			position: terrain_mesh.vertex_positions,
			normal: terrain_mesh.vertex_normals,
		},
		uniforms: {
			mat_mvp: regl.prop('mat_mvp'),
			mat_model_view: regl.prop('mat_model_view'),
			mat_model_view_light: regl.prop('mat_model_view_light'),
			mat_normals: regl.prop('mat_normals'),

			light_position: regl.prop('light_position'),
			shadowmap: shadowmap,
		},
		elements: terrain_mesh.faces,

		vert: resources['shaders/terrain.vert'],
		frag: resources['shaders/terrain.frag'],
	});

	const flattened_cubemap_pipeline = regl({
    attributes: {
      position: [
        [0., 0.],
        [1., 0.],
        [1., 1.],
        [0., 1.],
      ],
    },
    elements: [
      [0, 1, 2], // top right
      [0, 2, 3], // bottom left
    ],
    uniforms: {
      shadowmap_to_show: shadowmap,
      preview_rect_scale: ({viewportWidth, viewportHeight}) => {
        const aspect_ratio = viewportWidth / viewportHeight;

        const width_in_viewport_units = 0.8;
        const heigh_in_viewport_units = 0.4 * aspect_ratio;

        return [
          width_in_viewport_units,
          heigh_in_viewport_units,
        ];
      },
    },
    vert: resources.shader_vis_vert,
    frag: resources.shader_vis_frag,
  });

	const light_projection = mat4.ortho(mat4.create(), -1.0, 1.0, -1.0, 1.0, 0.1, 100)

	class TerrainActor {
		constructor() {
			this.mat_mvp = mat4.create();
			this.mat_model_view = mat4.create();
			this.mat_normals = mat3.create();
			this.mat_model_to_world = mat4.create();
		}

		render_shadowmap({light_position_world}) {
			const out_buffer = shadowmap
			// clear buffer, set distance to max
			regl.clear({
				color: [0, 0, 0, 1],
				depth: 1,
				framebuffer: out_buffer,
			});

			const mat_model_view = mat4.create();
			const look_at = mat4.lookAt(mat4.create(), light_position_world, [0,0,0], [0,1,0])
			mat4.multiply(mat_model_view, look_at, this.mat_model_to_world);
			const mat_mvp = mat4.create();
			mat4_matmul_many(mat_mvp, light_projection, mat_model_view);

			// Measure new distance map
			pipeline_shadowmap_generation({
				mat_mvp: mat_mvp,
				mat_model_view: mat_model_view,
				out_buffer: out_buffer,
			});
		}

		draw_phong_contribution({mat_projection, mat_view, light_position_cam, light_position_world}) {
			mat4_matmul_many(this.mat_model_view, mat_view, this.mat_model_to_world);
			mat4_matmul_many(this.mat_mvp, mat_projection, this.mat_model_view);

			mat3.fromMat4(this.mat_normals, this.mat_model_view);
			mat3.transpose(this.mat_normals, this.mat_normals);
			mat3.invert(this.mat_normals, this.mat_normals);

			const look_at = mat4.lookAt(mat4.create(), light_position_world, [0,0,0], [0,1,0]);
			const mat_model_view_light = mat4.multiply(mat4.create(), look_at, this.mat_model_to_world);

			pipeline_draw_terrain({
				mat_mvp: this.mat_mvp,
				mat_model_view: this.mat_model_view,
				mat_model_view_light: mat_model_view_light,
				mat_normals: this.mat_normals,

				light_position: light_position_cam,
			});
		}

		visualize_distance_map() {
			flattened_cubemap_pipeline();
		}
	}

	return new TerrainActor();
}
