"use strict";
/*
	Mesh construction and loading
*/

function icg_mesh_make_uv_sphere(divisions) {
	const {sin, cos, PI} = Math;

	const v_resolution = divisions | 0; // tell optimizer this is an int
	const u_resolution = 2*divisions;
	const n_vertices = v_resolution * u_resolution;
	const n_triangles = 2 * (v_resolution-1) * (u_resolution - 1);

	const vertex_positions = [];
	const tex_coords = [];

	for(let iv = 0; iv < v_resolution; iv++) {
		const v = iv / (v_resolution-1);
		const phi = v * PI;
		const sin_phi = sin(phi);
		const cos_phi = cos(phi);

		for(let iu = 0; iu < u_resolution; iu++) {
			const u = iu / (u_resolution-1);

			const theta = 2*u*PI;


			vertex_positions.push([
				cos(theta) * sin_phi,
				sin(theta) * sin_phi,
				cos_phi, 
			]);

			tex_coords.push([
				u,
				v,
			])
		}
	}

	const faces = [];

	for(let iv = 0; iv < v_resolution-1; iv++) {
		for(let iu = 0; iu < u_resolution-1; iu++) {
			const i0 = iu + iv * u_resolution;
			const i1 = iu + 1 + iv * u_resolution;
			const i2 = iu + 1 + (iv+1) * u_resolution;
			const i3 = iu + (iv+1) * u_resolution;

			faces.push([i0, i1, i2]);
			faces.push([i0, i2, i3]);
		}
	}

	return {
		name: `UvSphere(${divisions})`,
		vertex_positions: vertex_positions,
		vertex_normals: vertex_positions, // on a unit sphere, position is equivalent to normal
		vertex_tex_coords: tex_coords,
		faces: faces,
	}
}

function icg_mesh_make_cube() {
	return {
		name: 'Cube',
		vertex_positions: [
			// top
			[-1.0, -1.0,  1.0],
			[1.0, -1.0,  1.0],
			[1.0,  1.0,  1.0],
			[-1.0,  1.0,  1.0],
			// bottom
			[-1.0, -1.0, -1.0],
			[1.0, -1.0, -1.0],
			[1.0,  1.0, -1.0],
			[-1.0,  1.0, -1.0],
		],
		faces: [
			// front
			[0, 1, 2], [2, 3, 0],
			// right
			[1, 5, 6], [6, 2, 1],
			// back
			[7, 6, 5], [5, 4, 7],
			// left
			[4, 0, 3], [3, 7, 4],
			// bottom
			[4, 5, 1], [1, 0, 4],
			// top
			[3, 2, 6], [6, 7, 3],
		],
	}
}

